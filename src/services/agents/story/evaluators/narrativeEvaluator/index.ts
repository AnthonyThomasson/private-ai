import { db } from "@/db";
import { clueLinks } from "@/db/models/clueLink";
import { clues } from "@/db/models/clues";
import { murders } from "@/db/models/murders";
import { people } from "@/db/models/people";
import { ChatOpenAI } from "@langchain/openai";
import { eq } from "drizzle-orm";
import { readFileSync } from "fs";
import { join } from "path";
import { z } from "zod";

const NARRATIVE_CONSTRAINTS = readFileSync(
  join(__dirname, "prompts", "constraints.md"),
  "utf-8",
);

export const verifyNarrative = async (
  murderId: number,
): Promise<{ valid: boolean; reason?: string }> => {
  const murder = await db.query.murders.findFirst({
    where: eq(murders.id, murderId),
  });
  const allPeople = await db.query.people.findMany({
    where: eq(people.murderId, murderId),
  });
  const allClues = await db.query.clues.findMany({
    where: eq(clues.murderId, murderId),
  });
  const allLinks = await db.query.clueLinks.findMany({
    where: eq(clueLinks.murderId, murderId),
  });

  const state = JSON.stringify({
    murder: {
      id: murder?.id,
      description: murder?.description,
      victimId: murder?.victimId,
      perpetratorId: murder?.perpetratorId,
    },
    people: allPeople.map((p) => ({
      personId: p.id,
      name: p.name,
      age: p.age,
      gender: p.gender,
      occupation: p.occupation,
      description: p.description,
      personality: p.personality,
      motive: p.motive,
    })),
    clues: allClues.map((c) => ({
      clueId: c.id,
      description: c.description,
    })),
    clueLinks: allLinks.map((l) => ({
      clueLinkId: l.id,
      clueId: l.clueId,
      personId: l.personId,
      relation: l.description,
      isVisible: l.isVisible,
    })),
  });

  const model = new ChatOpenAI({ model: "o4-mini" });
  const schema = z.object({
    valid: z
      .boolean()
      .describe(
        "true if the narrative is coherent and meets all criteria, false otherwise",
      ),
    reason: z
      .string()
      .describe(
        "If invalid, the specific first violation found. If valid, return an empty string.",
      ),
  });
  const structuredLlm =
    model.withStructuredOutput<z.infer<typeof schema>>(schema);

  const result = await structuredLlm.invoke(
    `Review this murder mystery for narrative coherence. Return valid=true only if all criteria are met.

MURDER STATE:
${state}

CRITERIA:
${NARRATIVE_CONSTRAINTS}`,
    { recursionLimit: 100 },
  );

  return result;
};
