import { createDeepAgent } from "deepagents";
import { readFileSync } from "fs";
import { join } from "path";
import { buildFixTools } from "../fix-tools";

const SYSTEM_PROMPT = readFileSync(
  join(__dirname, "prompts", "system.md"),
  "utf-8",
);

export const runChainFix = async (
  murderId: number,
  reason: string,
  opts: { recursionLimit?: number } = {},
) => {
  const { recursionLimit = 16 } = opts;
  const fixAgent = createDeepAgent({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tools: buildFixTools(murderId) as any,
    model: "openai:o4-mini",
    systemPrompt: SYSTEM_PROMPT,
  });
  try {
    await fixAgent.invoke(
      {
        messages: [
          {
            role: "user",
            content: `Validation failed: "${reason}". Fix this and only this problem.`,
          },
        ],
      },
      { recursionLimit },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (
      msg.includes("recursion") ||
      msg.includes("recursion_limit") ||
      msg.includes("GRAPH_RECURSION")
    ) {
      console.warn(
        `⚠️  Chain fix hit recursion limit — treating as fix incomplete`,
      );
    } else {
      throw err;
    }
  }
};
