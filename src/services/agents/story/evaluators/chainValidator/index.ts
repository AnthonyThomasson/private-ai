import { db } from "@/db";
import { clueLinks } from "@/db/models/clueLink";
import { clues } from "@/db/models/clues";
import { murders } from "@/db/models/murders";
import { people } from "@/db/models/people";
import { eq } from "drizzle-orm";
import { runChainFix } from "./fixer";

/**
 * Validates the clue chain for a murder (ensures perpetrator is reachable from
 * the crime scene through the clue graph) and runs fix attempts when invalid.
 * Repeats until the chain is valid or the maximum number of fix attempts is
 * exhausted. Each fix invokes the chain validator agent to repair missing or
 * broken clue links.
 *
 * @param murderId - The murder to validate
 * @param maxFixAttempts - Maximum number of fix iterations before giving up
 * @param maxFixRecursionLimit - Recursion limit passed to the chain fix agent
 * @returns Object with valid flag, the validation result (depth map etc.), and
 *   the current murder record
 */
export async function validateAndFixChain(
  murderId: number,
  maxFixAttempts: number,
  maxFixRecursionLimit: number,
) {
  let murder;
  let validation;
  let fix = 0;
  while (true) {
    murder = await db.query.murders.findFirst({
      where: eq(murders.id, murderId),
    });
    validation = await validateChain(
      murderId,
      murder!.perpetratorId!,
      murder!.victimId!,
    );
    if (validation.valid) break;
    if (fix >= maxFixAttempts) break;
    fix++;
    console.warn(
      `🔧 Fix attempt ${fix}/${maxFixAttempts}: ${validation.reason}`,
    );
    await runChainFix(murderId, validation.reason!, {
      recursionLimit: maxFixRecursionLimit,
    });
  }
  return { valid: validation.valid, validation, murder };
}

/**
 * Validates that the perpetrator is reachable from crime-scene clues via the
 * clue graph, at least 2 steps away, with dead-end branches. Also checks that
 * the perpetrator's name does not leak into clue descriptions or relations.
 *
 * @param murderId - The murder to validate
 * @param perpetratorId - The perpetrator's person ID
 * @param victimId - The victim's person ID
 * @returns Validation result with valid flag, reason if invalid, and depth map
 */
async function validateChain(
  murderId: number,
  perpetratorId: number,
  victimId: number,
): Promise<{
  valid: boolean;
  reason?: string;
  depth?: Map<number, number>;
}> {
  const allLinks = await db.query.clueLinks.findMany({
    where: eq(clueLinks.murderId, murderId),
  });

  // Build: clueId → set of personIds linked to it
  const clueToPersons = new Map<number, Set<number>>();
  for (const link of allLinks) {
    if (!clueToPersons.has(link.clueId!))
      clueToPersons.set(link.clueId!, new Set());
    clueToPersons.get(link.clueId!)!.add(link.personId!);
  }

  // Initial suspects: visible links on non-victims
  const visiblePersonIds = new Set(
    allLinks
      .filter((l) => l.isVisible === 1 && l.personId !== victimId)
      .map((l) => l.personId!),
  );

  if (visiblePersonIds.size === 0) {
    return {
      valid: false,
      reason: "No initial suspects — all visible clue links are on the victim",
    };
  }

  // Perpetrator must NOT be visible at the start
  if (visiblePersonIds.has(perpetratorId)) {
    return {
      valid: false,
      reason: "Perpetrator is visible at the crime scene — must be hidden",
    };
  }

  // Build: personId → clueIds they're linked to
  const personToClueIds = new Map<number, number[]>();
  for (const link of allLinks) {
    if (!personToClueIds.has(link.personId!))
      personToClueIds.set(link.personId!, []);
    personToClueIds.get(link.personId!)!.push(link.clueId!);
  }

  // BFS through clue graph
  const depth = new Map<number, number>();
  const queue: number[] = [];
  for (const p of visiblePersonIds) {
    depth.set(p, 0);
    queue.push(p);
  }

  while (queue.length > 0) {
    const personId = queue.shift()!;
    const d = depth.get(personId)!;
    for (const clueId of personToClueIds.get(personId) ?? []) {
      for (const nextPerson of clueToPersons.get(clueId) ?? []) {
        if (!depth.has(nextPerson) && nextPerson !== victimId) {
          depth.set(nextPerson, d + 1);
          queue.push(nextPerson);
        }
      }
    }
  }

  if (!depth.has(perpetratorId)) {
    return {
      valid: false,
      reason: "Perpetrator is not reachable from crime-scene clues",
    };
  }
  const perpetratorDepth = depth.get(perpetratorId)!;
  if (perpetratorDepth < 2) {
    return {
      valid: false,
      reason: `Perpetrator only ${perpetratorDepth} step(s) from crime scene — need ≥ 2`,
    };
  }

  // Check that at least one initial suspect leads to a dead end (not toward perpetrator)
  const hasDeadEnd = Array.from(visiblePersonIds).some((p) => {
    const reachable = new Set<number>([p]);
    const q = [p];
    while (q.length > 0) {
      const cur = q.shift()!;
      for (const clueId of personToClueIds.get(cur) ?? []) {
        for (const next of clueToPersons.get(clueId) ?? []) {
          if (!reachable.has(next) && next !== victimId) {
            reachable.add(next);
            q.push(next);
          }
        }
      }
    }
    return !reachable.has(perpetratorId);
  });

  if (!hasDeadEnd) {
    return {
      valid: false,
      reason:
        "Every initial suspect leads to the perpetrator — need at least one dead-end branch",
    };
  }

  // Check that at least one visible clue link points to a CSI character
  const visibleLinks = allLinks.filter(
    (l) => l.isVisible === 1 && l.personId !== victimId,
  );
  const visiblePersonIdList = [
    ...new Set(visibleLinks.map((l) => l.personId!)),
  ];
  const visiblePeople = await db.query.people.findMany({
    where: (p, { inArray }) => inArray(p.id, visiblePersonIdList),
  });
  const hasCsiAtScene = visiblePeople.some(
    (p) => (p as { type?: string }).type === "csi",
  );
  if (!hasCsiAtScene) {
    return {
      valid: false,
      reason:
        "No CSI character linked to the initial visible crime-scene clues — at least one visible clue must link to a CSI character (type='csi')",
    };
  }

  // Check that the perpetrator is not a CSI character
  const perpetratorPerson = await db.query.people.findFirst({
    where: eq(people.id, perpetratorId),
  });
  if ((perpetratorPerson as { type?: string } | undefined)?.type === "csi") {
    return {
      valid: false,
      reason:
        "The perpetrator is a CSI character — CSI characters must never be the perpetrator",
    };
  }
  if (perpetratorPerson) {
    const perpetratorName = perpetratorPerson.name.toLowerCase();
    const allClues = await db.query.clues.findMany({
      where: eq(clues.murderId, murderId),
    });
    for (const clue of allClues) {
      if (clue.description.toLowerCase().includes(perpetratorName)) {
        return {
          valid: false,
          reason: `Perpetrator's name "${perpetratorPerson.name}" appears in clue description: "${clue.description.slice(0, 80)}..."`,
        };
      }
    }
    for (const link of allLinks) {
      if (
        link.personId !== perpetratorId &&
        link.description?.toLowerCase().includes(perpetratorName)
      ) {
        return {
          valid: false,
          reason: `Perpetrator's name "${perpetratorPerson.name}" appears in a clue relation for person ${link.personId}`,
        };
      }
    }

    // Check perpetrator name leak in other characters' occupations and descriptions
    const allPeople = await db.query.people.findMany({
      where: eq(people.murderId, murderId),
    });
    for (const person of allPeople) {
      if (person.id === perpetratorId) continue;
      if (person.occupation?.toLowerCase().includes(perpetratorName)) {
        return {
          valid: false,
          reason: `Perpetrator's name "${perpetratorPerson.name}" appears in ${person.name}'s occupation: "${person.occupation}"`,
        };
      }
      if (person.description?.toLowerCase().includes(perpetratorName)) {
        return {
          valid: false,
          reason: `Perpetrator's name "${perpetratorPerson.name}" appears in ${person.name}'s description`,
        };
      }
    }

    // Check bridge clue connectivity: informant relation should mention next suspect
    const allPeopleMap = new Map(allPeople.map((p) => [p.id, p]));
    for (const clueRow of allClues) {
      const linksForClue = allLinks.filter((l) => l.clueId === clueRow.id);
      // Skip visible clues (crime-scene clues, not bridges)
      if (linksForClue.some((l) => l.isVisible === 1)) continue;
      const linkedPersonIds = [
        ...new Set(linksForClue.map((l) => l.personId!)),
      ].filter((id) => id !== victimId);
      // Bridge clues link exactly 2 non-victim persons
      if (linkedPersonIds.length !== 2) continue;
      const [idA, idB] = linkedPersonIds;
      // Skip perpetrator-linking clues (can't name the perpetrator)
      if (idA === perpetratorId || idB === perpetratorId) continue;
      const personA = allPeopleMap.get(idA);
      const personB = allPeopleMap.get(idB);
      if (!personA || !personB) continue;
      const linkA = linksForClue.find((l) => l.personId === idA);
      const linkB = linksForClue.find((l) => l.personId === idB);
      const aRefB = linkA?.description
        ?.toLowerCase()
        .includes(personB.name.toLowerCase());
      const bRefA = linkB?.description
        ?.toLowerCase()
        .includes(personA.name.toLowerCase());
      if (!aRefB && !bRefA) {
        return {
          valid: false,
          reason: `Bridge clue "${clueRow.description.slice(0, 60)}..." — neither ${personA.name}'s nor ${personB.name}'s relation text mentions the other person. The informant's relation must name the next suspect so the player understands why a new person appeared.`,
        };
      }
    }
  }

  return { valid: true, depth };
}
