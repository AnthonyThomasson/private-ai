import { db } from "@/db";
import { murders } from "@/db/models/murders";
import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { generatePersonFromDescription } from "../person/person";
import { generateCluesFromMurder } from "../clue/clue";

export const generateMurder = async () => {
  const model = new ChatOpenAI({
    model: "gpt-4.1-nano",
    temperature: 1,
  });

  const schema = z.object({
    description: z
      .string()
      .describe("A 1 sentence description of a murder scene, including a body"),
  });

  const structuredLlm =
    model.withStructuredOutput<z.infer<typeof schema>>(schema);
  const murderDetails = await structuredLlm.invoke("Generate a crime scene");

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

  await db
    .update(murders)
    .set({
      locationId: victim?.locationId,
      victimId: victim?.id,
    })
    .where(eq(murders.id, murder.id));

  await generateCluesFromMurder(murder.id);

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
