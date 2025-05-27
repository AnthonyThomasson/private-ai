import { db } from "@/db";
import { murders } from "@/db/models/murders";
import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { generatePersonFromDescription } from "../person/person";
import { generateCluesFromMurder } from "../clue/generator";
import { murderTypes } from "./types";
import { generateImageForMurder } from "../../painter/murder";
import { randomInt } from "crypto";

export const generateMurder = async () => {
  const model = new ChatOpenAI({
    model: "gpt-4.1-nano",
    temperature: 1,
  });

  const randomType =
    murderTypes[Math.floor(Math.random() * murderTypes.length)];
  console.log("🔪 Generating murder of type:", randomType);
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
  let murderDetails: z.infer<typeof schema> = { description: "" };
  do {
    murderDetails = await structuredLlm.invoke(
      `Generate a crime scene for a ${randomType} murder, making no mention of the murder type`,
    );
  } while (randomInt(1, 5) !== 5);

  const [murder] = await db
    .insert(murders)
    .values({
      description: murderDetails.description ?? "",
    })
    .returning();

  const victim = await generatePersonFromDescription(
    murder.id,
    murderDetails.description ?? "",
    true,
  );

  await db
    .update(murders)
    .set({
      locationId: victim?.locationId,
      victimId: victim?.id,
    })
    .where(eq(murders.id, murder.id));

  await generateCluesFromMurder(murder.id);
  await generateImageForMurder(murder.id);

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
