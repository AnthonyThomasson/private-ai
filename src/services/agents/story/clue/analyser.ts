import path from "path";
import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";
import fs from "fs";

export const verifyClueAgainstContraint = async (args: {
  originalPrompt: string;
  clue: {
    description: string;
    relatedPeople: {
      relation: string;
      personId: number;
    }[];
  };
  disproveClue: {
    description: string;
    relatedPeople: {
      relation: string;
      personId: number;
    }[];
  };
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
      "src/services/agents/story/clueNEW/prompt",
      "constraints.md",
    ),
    "utf8",
  );

  const structuredLlm =
    model.withStructuredOutput<z.infer<typeof schema>>(schema);

  return await structuredLlm.invoke(
    `Verify if the clue meets the constraints. Return 'true' if it does and 'false' if it does not. If it does not, return the reason why.
    
      Clue: ${JSON.stringify(args)}

      Constraints: ${constraints}
    `,
  );
};
