import { db } from "@/db";
import { murders } from "@/db/models/murders";
import { ChatOpenAI } from "@langchain/openai";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { tool } from "@langchain/core/tools";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import path from "path";
import fs from "fs";
import { callWithRetry } from "../../utils";
import { verifyOutputAgainstConstraints } from "./analyser";

const getAddClueChainsTool = (murderId: number) => {
  let addedClueChain: string = "";

  const getClueChain = () => {
    return addedClueChain;
  };

  const addClueChain = tool(
    async (args: { direction: string; clueChain: string }): Promise<string> => {
      const murder = await db.query.murders.findFirst({
        where: eq(murders.id, murderId),
      });
      if (!murder) {
        throw new Error("Murder not found");
      }

      // verify against direction
      let result = await verifyOutputAgainstConstraints(
        murderId,
        JSON.stringify(args.clueChain),
        `Verify the clue chain follow the direction: "${args.direction}"`,
      );
      if (!result.valid) {
        console.log("❌ Invalid direction:");
        console.log("   reason:", result.reason);
        console.log("   clue chain:", args.clueChain);
        console.log("");
        return `RETRY: ${result.reason}`;
      }

      // verify against murder details
      result = await verifyOutputAgainstConstraints(
        murderId,
        JSON.stringify(args.clueChain),
        `Verify the clue chain makes sense in the context of the murder details and its clues. Note that 
        new people may be added to the murder investigation through the clue chain.
        
        Murder details: ${JSON.stringify(murder)}
        `,
      );
      if (!result.valid) {
        console.log("❌ Invalid inconsistent with murder details:");
        console.log("   reason:", result.reason);
        console.log("   clue chain:", args.clueChain);
        console.log("");
        return `RETRY: ${result.reason}`;
      }

      result = await verifyOutputAgainstConstraints(
        murderId,
        JSON.stringify(args.clueChain),
        fs.readFileSync(
          path.join(
            process.cwd(),
            "src/services/agents/story/clue/prompt/clue_chain_constraints.md",
          ),
          "utf8",
        ),
      );
      if (!result.valid) {
        console.log("❌ Invalid constraints:");
        console.log("   reason:", result.reason);
        console.log("   clue chain:", args.clueChain);
        console.log("");
        return `RETRY: ${result.reason}`;
      }
      addedClueChain = args.clueChain;
      return "success";
    },
    {
      name: "addClueChain",
      description: "Add clue chain to the murder",
      schema: z.object({
        direction: z.string(),
        clueChain: z
          .string()
          .describe(
            "A list of clues representing a chain of leads and information that may be relevant to the murder.",
          ),
      }),
    },
  );

  return {
    addClueChain,
    getClueChain,
  };
};

export const getClueChainToGenerate = async (
  murderId: number,
  direction: string,
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

  const { addClueChain, getClueChain } = getAddClueChainsTool(murderId);

  const agent = createReactAgent({
    llm: new ChatOpenAI({
      model: "gpt-4.1-mini",
      openAIApiKey: process.env.OPENAI_API_KEY,
    }),
    tools: [addClueChain],
  });

  const promptTemplate = ChatPromptTemplate.fromMessages([
    [
      "system",
      `You are a helpful assistant that generates clue chains for a murder, based on the murder details and an additional direction. 
    
      # CONSTRAINTS
      {constraints}
      `,
    ],
    [
      "human",
      `Generate a chain of clues for the murder. Call the tool "addClueChain" to add the clue chain to the murder. The clue chain should be relevant to the murder and the direction.
      
      Direction: {direction}
      Murder: {murder}
      `,
    ],
  ]);

  const formattedPrompt = await promptTemplate.formatMessages({
    direction: direction,
    murder: JSON.stringify(murder),
    constraints: fs.readFileSync(
      path.join(
        process.cwd(),
        "src/services/agents/story/clue/prompt/clue_chain_constraints.md",
      ),
      "utf8",
    ),
  });

  await callWithRetry(async () =>
    agent.invoke({ messages: formattedPrompt }, { recursionLimit: 100 }),
  );

  return getClueChain();
};
