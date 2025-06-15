import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";
import { murders } from "@/db/models/murders";
import { db } from "@/db";
import { eq } from "drizzle-orm";
import { callWithRetry } from "../../utils";

export const verifyOutputAgainstConstraints = async (
  murderId: number,
  output: string,
  constraints: string,
  retryCount: number = 3,
) => {
  const murder = await db.query.murders.findFirst({
    where: eq(murders.id, murderId),
    with: {
      victim: true,
      clueLinks: {
        with: {
          clue: true,
          person: true,
        },
      },
    },
  });

  const model = new ChatOpenAI({
    model: "o4-mini",
  });

  const schema = z.object({
    valid: z
      .boolean()
      .describe(
        "Return 'true' if the clue follows the rule and 'false' if it does not",
      ),
    reason: z
      .string()
      .describe(`If the clue does not follow the rules, return the reason why`),
  });

  const structuredLlm =
    model.withStructuredOutput<z.infer<typeof schema>>(schema);

  let result;
  let count = 0;
  do {
    result = await callWithRetry(async () =>
      structuredLlm.invoke(
        `Verify if the output meets the following rules. Return 'true' if it does and 'false' if it does not. If it does not, return the reason why.
    
      OUTPUT: ${output}

      MURDER: ${JSON.stringify(murder)}

      RULES: ${constraints}
      `,
        { recursionLimit: 100 },
      ),
    );

    if (!result.valid) {
      return result;
    }
  } while (count++ < retryCount);

  if (result) {
    return result;
  }

  return {
    valid: false,
    reason: "Failed to verify output against constraints",
  };
};
