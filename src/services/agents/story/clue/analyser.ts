import path from "path";
import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";
import fs from "fs";
import { murders } from "@/db/models/murders";
import { db } from "@/db";
import { eq } from "drizzle-orm";

export const verifyClueAgainstContraint = async (clue: {
  description: string;
  relatedPeople: {
    relation: string;
    personId: number;
  }[];
}) => {
  const model = new ChatOpenAI({
    model: "o4-mini",
  });

  const schema = z.object({
    valid: z
      .boolean()
      .describe(
        "Return 'true' if the clue meets the cronstraints and 'false' if it does not",
      ),
    reason: z
      .string()
      .describe(`If the clue does not meet the contraints return false`),
  });

  const constraints = fs.readFileSync(
    path.join(
      process.cwd(),
      "src/services/agents/story/clue/prompt",
      "constraints.md",
    ),
    "utf8",
  );

  const structuredLlm =
    model.withStructuredOutput<z.infer<typeof schema>>(schema);

  return await structuredLlm.invoke(
    `Verify if the clue meets the constraints. Return 'true' if it does and 'false' if it does not. If it does not, return the reason why.
    
      Clue: ${JSON.stringify(clue)}

      Constraints: ${constraints}
    `,
  );
};

export const numCluesRelatedToCrimeScene = async (murderId: number) => {
  const murder = await db.query.murders.findFirst({
    where: eq(murders.id, murderId),
    with: {
      clueLinks: {
        with: {
          clue: true,
        },
      },
    },
  });
  if (!murder) {
    throw new Error("Murder not found");
  }

  const model = new ChatOpenAI({
    model: "o4-mini",
  });

  const schema = z.object({
    numClues: z
      .number()
      .describe("The number of clues related to the crime scene"),
  });

  const structuredLlm =
    model.withStructuredOutput<z.infer<typeof schema>>(schema);

  return await structuredLlm.invoke(
    `Return the number of clues related to the crime scene.
    
      Murder: ${JSON.stringify(murder)}
    `,
  );
};

export const hasEnoughCluesToSolveMurder = async (murderId: number) => {
  const murder = await db.query.murders.findFirst({
    where: eq(murders.id, murderId),
    with: {
      clueLinks: {
        with: {
          clue: true,
          person: true,
        },
      },
    },
  });
  if (!murder) {
    throw new Error("Murder not found");
  }

  const model = new ChatOpenAI({
    model: "o4-mini",
  });

  const schema = z.object({
    murdererId: z
      .number()
      .describe("The person ID of the murderer, if there are enough clues"),
    enoughClues: z
      .boolean()
      .describe(
        `Return 'true' if there are enough clues to solve the murder, and 'false' if there are not`,
      ),
  });

  const structuredLlm =
    model.withStructuredOutput<z.infer<typeof schema>>(schema);

  return await structuredLlm.invoke(
    `Verify if there are enough clues present to solve the murder. There must be a clear murderer present based on the clues. The murderer must not be identified soly by physical evidence at the crime scene.
    
      Clues: ${JSON.stringify(murder.clueLinks)}
    `,
  );
};
