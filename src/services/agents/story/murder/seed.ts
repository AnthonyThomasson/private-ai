import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";
import { pickRandom } from "../../utils/randomModifier";

type Context = {
  location: string | null;
  type: string | null;
  era: string | null;
  tone: string | null;
  socialSetting: string | null;
  motiveCategory: string | null;
  responseStyle: string;
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
    `Generate a list of 10 distinct time periods or eras for a murder mystery (e.g. 1920s, Victorian London, 1970s, modern day). Each in no more than 5 words.`,
  );
  context.era = pickRandom(result.eras);
  return context;
};

const getTone = async (context: Context): Promise<Context> => {
  const model = new ChatOpenAI({ model: "gpt-4.1-mini" });
  const schema = z.object({
    tones: z.array(
      z
        .string()
        .describe(
          "A narrative tone for a murder mystery, in no more than 10 words",
        ),
    ),
  });
  const structuredLlm =
    model.withStructuredOutput<z.infer<typeof schema>>(schema);
  const result = await structuredLlm.invoke(
    `Generate a list of 10 narrative tones for a murder mystery (e.g. dark noir, cozy mystery, psychological thriller, procedural). Each in no more than 5 words.`,
  );
  context.tone = pickRandom(result.tones);
  return context;
};

const getSocialSetting = async (context: Context): Promise<Context> => {
  const model = new ChatOpenAI({ model: "gpt-4.1-mini" });
  const schema = z.object({
    settings: z.array(
      z
        .string()
        .describe("A social milieu or setting, in no more than 10 words"),
    ),
  });
  const structuredLlm =
    model.withStructuredOutput<z.infer<typeof schema>>(schema);
  const result = await structuredLlm.invoke(
    `Generate a list of 10 social milieus for a murder mystery (e.g. high society, small town, corporate, family dynasty, academic). Each in no more than 5 words.`,
  );
  context.socialSetting = pickRandom(result.settings);
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
    `Generate a list of 10 motive categories for murder mysteries (e.g. inheritance, blackmail, jealousy, revenge, silencing witness, financial fraud). Each in no more than 5 words.`,
  );
  context.motiveCategory = pickRandom(result.categories);
  return context;
};

const RESPONSE_STYLE_MODIFIERS = [
  "Keep responses terse and evasive. Answer in fragments.",
  "Elaborate when asked. Tend to over-explain.",
  "Use dry humor and sarcasm when deflecting.",
  "Respond formally, as if being deposed.",
  "Speak colloquially. Use contractions and filler words.",
  "Be curt and dismissive. Give minimal answers.",
  "Rambling and nervous. Tangents when stressed.",
  "Guarded but polite. Deflect with questions.",
  "Cold and measured. Choose words carefully.",
  "Emotional and defensive. React strongly to accusations.",
  "Sarcastic and witty. Deflect with jokes.",
  "Evasive and vague. Never give a straight answer.",
  "Overly helpful. Volunteer too much, then backtrack.",
  "Prickly and short-tempered. Snap when pressed.",
  "Meek and apologetic. Defer and downplay.",
];

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
    tone: null,
    socialSetting: null,
    motiveCategory: null,
    responseStyle: "",
  };

  let maxAttempts = 10;
  do {
    for (const fn of shuffle([getTypeOfMurder, getLocationOfMurder])) {
      context = await fn(context);
    }
    maxAttempts--;
  } while (!(await isItPossible(context)) && maxAttempts > 0);

  for (const fn of shuffle([
    getEra,
    getTone,
    getSocialSetting,
    getMotiveCategory,
  ])) {
    context = await fn(context);
  }

  context.responseStyle = pickRandom(RESPONSE_STYLE_MODIFIERS);

  return context;
};
