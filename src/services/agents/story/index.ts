import { db } from "@/db";
import { clueLinks } from "@/db/models/clueLink";
import { clues } from "@/db/models/clues";
import { locations } from "@/db/models/location";
import { murders } from "@/db/models/murders";
import { people } from "@/db/models/people";
import { createDeepAgent } from "deepagents";
import { eq } from "drizzle-orm";
import { runChainFix } from "./evaluators/chainValidator/fixer";
import { validateChain } from "./evaluators/chainValidator/index";
import { runNarrativeFix } from "./evaluators/narrativeEvaluator/fixer";
import { verifyNarrative } from "./evaluators/narrativeEvaluator/index";
import { generateImageForMurder } from "./painter/murder";
import { generateImageForPerson } from "./painter/person";
import { getMurderSeed } from "./seed";
import { SYSTEM_PROMPT, buildTools } from "./tools";

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
async function validateAndFixChain(
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
 * Verifies narrative coherence of a murder (clue descriptions, motives, story
 * consistency) and runs fix attempts when invalid. Repeats until the narrative
 * is valid or the maximum number of fix attempts is exhausted. Each fix
 * invokes the narrative evaluator agent to correct inconsistencies.
 *
 * @param murderId - The murder to verify
 * @param maxFixAttempts - Maximum number of fix iterations before giving up
 * @param maxFixRecursionLimit - Recursion limit passed to the narrative fix agent
 * @returns Object with valid flag and the narrative verification result
 */
async function validateAndFixNarrative(
  murderId: number,
  maxFixAttempts: number,
  maxFixRecursionLimit: number,
) {
  let narrative = await verifyNarrative(murderId);
  let fix = 0;
  while (!narrative.valid && fix < maxFixAttempts) {
    fix++;
    console.warn(
      `🔧 Narrative fix attempt ${fix}/${maxFixAttempts}: ${narrative.reason}`,
    );
    await runNarrativeFix(murderId, narrative.reason!, {
      recursionLimit: maxFixRecursionLimit,
    });
    narrative = await verifyNarrative(murderId);
  }
  return { valid: narrative.valid, narrative };
}

const cleanupMurder = async (murderId: number) => {
  // Nullify FK references on murder first to avoid circular FK violations
  await db
    .update(murders)
    .set({ victimId: null, perpetratorId: null, locationId: null })
    .where(eq(murders.id, murderId));
  await db.delete(clueLinks).where(eq(clueLinks.murderId, murderId));
  await db.delete(clues).where(eq(clues.murderId, murderId));
  // Delete people before locations (people hold the locationId FK)
  await db.delete(people).where(eq(people.murderId, murderId));
  await db.delete(locations).where(eq(locations.murderId, murderId));
  await db.delete(murders).where(eq(murders.id, murderId));
};

export const generateMurder = async (
  maxRetries = 3,
  maxFixAttempts = 2,
  maxFixRecursionLimit = 16,
) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const { tools, getMurderId } = buildTools();

    const agent = createDeepAgent({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tools: tools as any,
      model: "openai:gpt-4.1-mini",
      systemPrompt: SYSTEM_PROMPT,
    });

    const seed = await getMurderSeed();
    console.log(
      `🗿 Inspiration: ${seed.type} | ${seed.location} | ${seed.era} | ${seed.motiveCategory}`,
    );

    console.log(
      `🌱 Deep agent generating murder mystery... (attempt ${attempt}/${maxRetries})`,
    );
    await agent.invoke({
      messages: [
        {
          role: "user",
          content: `Generate a murder mystery. Use this as inspiration: a ${seed.type} in ${seed.location}. Era: ${seed.era}. Motive inspiration (category only): ${seed.motiveCategory}. The actual motive must be specific and grounded in the story.`,
        },
      ],
    });

    const murderId = getMurderId();

    const {
      valid: chainValid,
      validation,
      murder,
    } = await validateAndFixChain(
      murderId,
      maxFixAttempts,
      maxFixRecursionLimit,
    );

    if (!chainValid) {
      console.warn(
        `⚠️  Attempt ${attempt}: still invalid after fixes — ${validation.reason}. Cleaning up...`,
      );
      await cleanupMurder(murderId);
      if (attempt === maxRetries) {
        throw new Error(
          `Failed to generate a valid murder mystery after ${maxRetries} attempts`,
        );
      }
      continue;
    }

    const perpetratorDepth = validation.depth!.get(murder!.perpetratorId!)!;
    console.log(
      `✅ Chain validated — perpetrator is ${perpetratorDepth} step(s) from crime scene`,
    );

    const { valid: narrativeValid, narrative } = await validateAndFixNarrative(
      murderId,
      maxFixAttempts,
      maxFixRecursionLimit,
    );

    if (!narrativeValid) {
      console.warn(
        `⚠️  Attempt ${attempt}: narrative still invalid after fixes — ${narrative.reason}. Cleaning up...`,
      );
      await cleanupMurder(murderId);
      if (attempt === maxRetries) {
        throw new Error(
          `Failed to generate a narratively coherent murder mystery after ${maxRetries} attempts`,
        );
      }
      continue;
    }
    console.log(`✅ Narrative verified`);

    console.log("🖼️  Painting artwork");
    await generateImageForMurder(murderId);

    const peopleInMurder = await db.query.people.findMany({
      where: eq(people.murderId, murderId),
    });
    await Promise.all(peopleInMurder.map((p) => generateImageForPerson(p.id)));

    return db.query.murders.findFirst({
      where: eq(murders.id, murderId),
      with: {
        location: true,
        victim: true,
        perpetrator: true,
        people: true,
        clueLinks: {
          with: {
            clue: true,
            person: true,
          },
        },
      },
    });
  }
};
