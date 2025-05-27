import { db } from "@/db";
import { locations } from "@/db/models/location";
import { people, Person } from "@/db/models/people";
import { ChatOpenAI } from "@langchain/openai";
import { count, eq } from "drizzle-orm";
import { z } from "zod";

export const generatePersonFromDescription = async (
  murderId: number,
  description: string,
) => {
  const model = new ChatOpenAI({
    model: "o4-mini",
  });

  const schema = z.object({
    name: z.string().describe("The name of the person"),
    age: z.number().describe("The age of the person"),
    occupation: z.string().describe("The occupation of the person"),
    gender: z.enum(["male", "female"]).describe("The gender of the person"),
    description: z
      .string()
      .describe("A 1 sentence physical description of the person"),
    personality: z
      .string()
      .describe("a comma separated list of single word personality traits"),
    address: z.string().describe("The address of the person"),
    location: z.string().describe(
      `A 1 sentence description of the location the person is at, describe the physical space. 
      Do NOT mention the person.`,
    ),
  });

  const structuredLlm =
    model.withStructuredOutput<z.infer<typeof schema>>(schema);

  let personDetails;
  for (let i = 0; i < 10; i++) {
    personDetails = await structuredLlm.invoke([
      ["system", "Generate a person based on a description."],
      ["human", description],
    ]);

    const numSameName = (
      await db
        .select({ count: count() })
        .from(people)
        .where(eq(people.name, personDetails.name))
    )[0].count;
    if (numSameName === 0) {
      break;
    } else {
      console.log("🔍 Person already exists, trying again");
    }
  }

  if (!personDetails) {
    throw new Error("Failed to generate person");
  }

  const [location] = await db
    .insert(locations)
    .values({
      address: personDetails.address,
      description: personDetails.location,
    })
    .returning();

  const [person] = await db
    .insert(people)
    .values({
      name: personDetails.name,
      age: personDetails.age,
      gender: personDetails.gender,
      occupation: personDetails.occupation,
      description: personDetails.description,
      personality: personDetails.personality,
      locationId: location.id,
      murderId: murderId,
    })
    .returning();

  return (await db.query.people.findFirst({
    where: eq(people.id, person.id),
    with: {
      location: true,
    },
  })) as Person;
};
