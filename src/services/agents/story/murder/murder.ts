import { db } from "@/db";
import { clueLinks } from "@/db/models/clueLink";
import { murders } from "@/db/models/murders";
import { people } from "@/db/models/people";
import { ChatOpenAI } from "@langchain/openai";
import { and, eq, exists, not } from "drizzle-orm";
import { z } from "zod";
import { generateImageForMurder } from "../../painter/murder";
import { generateImageForPerson } from "../../painter/person";
import { generateCluesFromMurder } from "../clue/generator";
import { generatePersonFromDescription } from "../person/person";
import { getMurderSeed } from "./seed";

export const generateMurder = async () => {
  const model = new ChatOpenAI({
    model: "gpt-4.1-mini",
  });

  const { type, location } = await getMurderSeed();
  console.log("🔪 Generating Murder");
  console.log("   Murder type:", type);
  console.log("   Murder location:", location);
  console.log("");

  const schema = z.object({
    description: z
      .string()
      .describe(
        `A 1 sentence description of the murder scene, including a body`,
      ),
  });

  const structuredLlm =
    model.withStructuredOutput<z.infer<typeof schema>>(schema);

  const murderDetails = await structuredLlm.invoke(
    `Generate a crime scene for a ${type} murder in the location ${location}, making no mention of the provided murder 
    type or location directly. Include a description of the cause of death. The crime should not involve science fiction elements, and be a realistic interpretation of the crime scene. 
    Include no people other than the body.`,
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

  const perpetrator = await generatePersonFromDescription(
    murder.id,
    `The perpetrator of the murder: 
    
    ${JSON.stringify(murder.description)}`,
  );

  await db
    .update(murders)
    .set({
      locationId: victim?.locationId,
      victimId: victim?.id,
      perpetratorId: perpetrator?.id,
    })
    .where(eq(murders.id, murder.id));

  console.log("🫆 Murder details:");
  console.log({
    description: murderDetails.description,
    victim: victim?.name,
    perpetrator: perpetrator?.name,
  });
  console.log("");

  await generateCluesFromMurder(murder.id);

  console.log("🖼️  Painting artwork");
  await generateImageForMurder(murder.id);

  await db
    .delete(people)
    .where(
      and(
        eq(people.murderId, murder.id),
        not(eq(people.id, victim.id)),
        not(eq(people.id, perpetrator.id)),
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
