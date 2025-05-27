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
export const isClueFoundAtCrimeScene = async (
  murderId: number,
  clue: {
    description: string;
    relatedPeople: {
      relation: string;
      personId: number;
    }[];
  },
) => {
  const murder = await db.query.murders.findFirst({
    where: eq(murders.id, murderId),
  });
  if (!murder) {
    throw new Error("Murder not found");
  }

  const model = new ChatOpenAI({
    model: "o4-mini",
  });

  const schema = z.object({
    found: z
      .boolean()
      .describe(
        `Return 'true' if the clue is related to the physical crime scene, and 'false' if it is not.`,
      ),
  });

  const structuredLlm =
    model.withStructuredOutput<z.infer<typeof schema>>(schema);

  return await structuredLlm.invoke(
    `Verify if the clue is related to the physical crime scene. Return 'true' if it is and 'false' if it is not. If it is not, return the reason why.
    
      Clue: ${JSON.stringify(clue)}

      Murder: ${JSON.stringify(murder)}
    `,
  );
};

export const isClueFollowingTheModifier = async (
  modifier: string,
  clue: {
    description: string;
    relatedPeople: {
      relation: string;
      personId: number;
    }[];
  },
) => {
  const model = new ChatOpenAI({
    model: "o4-mini",
  });

  const schema = z.object({
    following: z
      .boolean()
      .describe(
        "Return 'true' if the clue is following the modifier, and 'false' if it is not",
      ),
    reason: z
      .string()
      .describe(
        `If the clue is not following the modifier, return the reason why.`,
      ),
  });

  const structuredLlm =
    model.withStructuredOutput<z.infer<typeof schema>>(schema);

  return await structuredLlm.invoke(
    `Verify if the clue is following the modifier. Return 'true' if it is and 'false' if it is not. If it is not, return the reason why.
    
      Clue: ${JSON.stringify(clue)}

      Modifier: ${modifier}
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
