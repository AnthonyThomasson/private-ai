import { db } from "@/db";
import { murders } from "@/db/models/murders";
import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";
import { eq, not, and, exists } from "drizzle-orm";
import { generatePersonFromDescription } from "../person/person";
import { generateCluesFromMurder } from "../clue/generator";
import { generateImageForMurder } from "../../painter/murder";
import { people } from "@/db/models/people";
import { generateImageForPerson } from "../../painter/person";
import { clueLinks } from "@/db/models/clueLink";
import { getMurderSeed } from "./seed";

export const generateMurder = async () => {
  const model = new ChatOpenAI({
    model: "o4-mini",
  });

  const { type, location } = await getMurderSeed();
  console.log("🔪 Generating Murder");
  console.log("   Murder type:", type);
  console.log("   Murder location:", location);

  const schema = z.object({
    description: z
      .string()
      .describe(
        `A 1 sentence description of the murder scene, including a body`,
      ),
  });

  const structuredLlm =
    model.withStructuredOutput<z.infer<typeof schema>>(schema);

  // Retry x amount of time to get a more varied murder description
  const murderDetails = await structuredLlm.invoke(
    `Generate a crime scene for a ${type} murder in the location ${location}, making no mention of the provided murder type or location directly`,
  );

  const [murder] = await db
    .insert(murders)
    .values({
      description: murderDetails.description ?? "",
    })
    .returning();

  const victim = await generatePersonFromDescription(
    murder.id,
    murderDetails.description ?? "",
  );

  console.log("🔪 Murder details:", murderDetails);
  console.log("");

  await db
    .update(murders)
    .set({
      locationId: victim?.locationId,
      victimId: victim?.id,
    })
    .where(eq(murders.id, murder.id));

  await generateCluesFromMurder(murder.id);

  console.log("🖼️ Painting artwork");
  await generateImageForMurder(murder.id);

  await db
    .delete(people)
    .where(
      and(
        eq(people.murderId, murder.id),
        not(eq(people.id, victim.id)),
        not(
          exists(
            db
              .select()
              .from(clueLinks)
              .where(eq(clueLinks.personId, people.id)),
          ),
        ),
      ),
    );

  const peopleInMurder = await db.query.people.findMany({
    where: eq(people.murderId, murder.id),
  });
  await Promise.all(
    peopleInMurder.map(async (p) => {
      await generateImageForPerson(p.id);
    }),
  );

  return await db.query.murders.findFirst({
    where: eq(murders.id, murder.id),
    with: {
      location: true,
      victim: true,
      people: true,
      clueLinks: {
        with: {
          clue: true,
        },
      },
    },
  });
};
