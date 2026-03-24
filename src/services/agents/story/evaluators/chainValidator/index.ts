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

  // Check that the perpetrator's name does not appear in any clue description or relation text
  const perpetratorPerson = await db.query.people.findFirst({
    where: eq(people.id, perpetratorId),
  });
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
  }

  return { valid: true, depth };
}
