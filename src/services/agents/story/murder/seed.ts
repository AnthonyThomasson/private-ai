import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";

type Context = {
  location: string | null;
  type: string | null;
};

const getTypeOfMurder = async (context: Context): Promise<Context> => {
  const model = new ChatOpenAI({
    model: "o4-mini",
  });

  const schema = z.object({
    types: z.array(
      z
        .string()
        .describe("A type of murder, described in no more than 10 words"),
    ),
  });

  const structuredLlm =
    model.withStructuredOutput<z.infer<typeof schema>>(schema);

  let murderTypes: z.infer<typeof schema> = { types: [] };
  if (context.location) {
    murderTypes = await structuredLlm.invoke(
      `Generate a list of 10 types of murders with one victim that could happen in a realistic story on earth in the location ${context.location}. Do not include legal types of murder. Describe each type in no more than 5 words.`,
    );
  } else {
    murderTypes = await structuredLlm.invoke(
      `Generate a list of 10 types of murders with one victim that could happen in a realistic story on earth. Do not include legal types of murder. Describe each type in no more than 5 words.`,
    );
  }
  console.log("🤖 Murder types:", murderTypes);
  context.type =
    murderTypes.types[Math.floor(Math.random() * murderTypes.types.length)];
  return context;
};

const getLocationOfMurder = async (context: Context): Promise<Context> => {
  const model = new ChatOpenAI({
    model: "o4-mini",
  });

  const schema = z.object({
    locations: z.array(
      z.string().describe("A location, described in no more than 10 words"),
    ),
  });

  const structuredLlm =
    model.withStructuredOutput<z.infer<typeof schema>>(schema);
  let locations: z.infer<typeof schema> = { locations: [] };
  try {
    if (context.location) {
      locations = await structuredLlm.invoke(
        `Generate a list of 10 realistic locations that a murder of type ${context.type} could happen in. Describe each location in no more than 5 words.`,
      );
    } else {
      locations = await structuredLlm.invoke(
        `Generate a list of 10 realistic locations that a murder could happen in on earth. Describe each location in no more than 5 words.`,
      );
    }
  } catch (error) {
    console.error("🤖 Error getting murder locations:", error);
  }
  console.log("🤖 Murder locations:", locations);
  context.location =
    locations.locations[Math.floor(Math.random() * locations.locations.length)];
  return context;
};

function shuffle<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

export const getMurderSeed = async () => {
  let context: Context = {
    location: null,
    type: null,
  };

  for (const fn of shuffle([getTypeOfMurder, getLocationOfMurder])) {
    context = await fn(context);
  }
  return context;
};
