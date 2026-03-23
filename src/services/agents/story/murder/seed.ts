import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";
import { pickRandom } from "../../utils/randomModifier";

type Context = {
  location: string | null;
  type: string | null;
  era: string | null;
  motiveCategory: string | null;
};

const getTypeOfMurder = async (context: Context): Promise<Context> => {
  const model = new ChatOpenAI({
    model: "gpt-4.1-mini",
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
      `Generate a list of 20 types of murders with one victim that could happen in a realistic story
      on earth in the location ${context.location}. Do not include legal types of murder. Describe 
      each type in no more than 5 words. Include a variety in the ways the death could have occurred.`,
    );
  } else {
    murderTypes = await structuredLlm.invoke(
      `Generate a list of 20 types of murders with one victim that could happen in a realistic story on
       earth. Do not include legal types of murder. Describe each type in no more than 5 words. Include 
       a variety in the ways the death could have occurred.`,
    );
  }
  context.type = pickRandom(murderTypes.types);
  return context;
};

const getLocationOfMurder = async (context: Context): Promise<Context> => {
  const model = new ChatOpenAI({
    model: "gpt-4.1-mini",
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
        `Generate a list of 20 realistic locations that a murder of type ${context.type} could happen in. Describe each location in no more than 5 words.`,
      );
    } else {
      locations = await structuredLlm.invoke(
        `Generate a list of 20 realistic locations that a murder could happen in on earth. Describe each location in no more than 5 words.`,
      );
    }
  } catch (error) {
    console.error("🤖 Error getting murder locations:", error);
  }
  context.location = pickRandom(locations.locations);
  return context;
};

const getEra = async (context: Context): Promise<Context> => {
  const model = new ChatOpenAI({ model: "gpt-4.1-mini" });
  const schema = z.object({
    eras: z.array(
      z.string().describe("A time period or era, in no more than 10 words"),
    ),
  });
  const structuredLlm =
    model.withStructuredOutput<z.infer<typeof schema>>(schema);
  const result = await structuredLlm.invoke(
    `Generate a list of 20 distinct time periods or eras for a murder mystery (e.g. 1920s, Victorian London, 1970s, modern day). Each in no more than 5 words.`,
  );
  context.era = pickRandom(result.eras);
  return context;
};

const getMotiveCategory = async (context: Context): Promise<Context> => {
  const model = new ChatOpenAI({ model: "gpt-4.1-mini" });
  const schema = z.object({
    categories: z.array(
      z.string().describe("A motive category, in no more than 10 words"),
    ),
  });
  const structuredLlm =
    model.withStructuredOutput<z.infer<typeof schema>>(schema);
  const result = await structuredLlm.invoke(
    `Generate a list of 20 motive categories for murder mysteries (e.g. inheritance, blackmail, jealousy, revenge, silencing witness, financial fraud). Each in no more than 5 words.`,
  );
  context.motiveCategory = pickRandom(result.categories);
  return context;
};

function shuffle<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

const isItPossible = async (context: Context): Promise<boolean> => {
  const model = new ChatOpenAI({
    model: "gpt-4.1-mini",
  });

  const schema = z.object({
    isPossible: z
      .boolean()
      .describe(
        "Whether the murder is possible, and that it contains only one victim",
      ),
  });

  const structuredLlm =
    model.withStructuredOutput<z.infer<typeof schema>>(schema);

  const isPossible = await structuredLlm.invoke(
    `Is it possible for a murder of type ${context.type} to happen in the location ${context.location}, and does the murder contain only one victim?`,
  );
  return isPossible.isPossible;
};
export const getMurderSeed = async () => {
  let context: Context = {
    location: null,
    type: null,
    era: null,
    motiveCategory: null,
  };

  let maxAttempts = 10;
  do {
    for (const fn of shuffle([getTypeOfMurder, getLocationOfMurder])) {
      context = await fn(context);
    }
    maxAttempts--;
  } while (!(await isItPossible(context)) && maxAttempts > 0);

  for (const fn of shuffle([getEra, getMotiveCategory])) {
    context = await fn(context);
  }

  return context;
};
