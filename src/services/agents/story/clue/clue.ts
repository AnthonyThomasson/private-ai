import { db } from "@/db";
import { murders } from "@/db/models/murders";
import { ChatOpenAI } from "@langchain/openai";
import { eq } from "drizzle-orm";
import { randomInt } from "node:crypto";
import { z } from "zod";
import { generatePersonFromDescription } from "../person/person";
import { clues } from "@/db/models/clues";
import { clueLinks } from "@/db/models/clueLink";

export const generateCluesFromMurder = async (murderId: number) => {
  const numClues = randomInt(1, 3);

  const murder = await db.query.murders.findFirst({
    where: eq(murders.id, murderId),
    with: {
      location: true,
    },
  });

  for (let index = 0; index < numClues; index++) {
    await generateClueFromDescription(murderId, murder?.description ?? "");
  }

  return await db.query.clues.findMany({
    where: eq(clues.murderId, murderId),
  });
};

export const generateClueFromDescription = async (
  murderId: number,
  description: string,
) => {
  const model = new ChatOpenAI({
    model: "o4-mini",
  });

  const schema = z.object({
    description: z
      .string()
      .describe(
        "A 1 sentence description of a clue related to the description, clues are not always incriminating, and must include someone other the victim",
      ),
    relatedPeople: z.array(
      z
        .object({
          relation: z
            .string()
            .describe(
              "A 1 sentence description describing the persons relation to the clue",
            ),
        })
        .describe(
          "There are always at least 1 person related to the clue, but there can be more",
        ),
    ),
  });

  const structuredLlm =
    model.withStructuredOutput<z.infer<typeof schema>>(schema);

  const result = await structuredLlm.invoke(
    `Generate a clue based on the following details: ${description}`,
  );

  const [clue] = await db
    .insert(clues)
    .values({
      murderId,
      description: result.description,
    })
    .returning();

  for (const relatedPerson of result.relatedPeople) {
    const person = await generatePersonFromDescription(
      murderId,
      relatedPerson.relation,
    );

    await db.insert(clueLinks).values({
      clueId: clue.id,
      description: relatedPerson.relation,
      personId: person.id,
      murderId: murderId,
    });
  }

  return await db.query.clues.findFirst({
    where: eq(clues.id, clue.id),
    with: {
      clueLinks: true,
    },
  });
};
