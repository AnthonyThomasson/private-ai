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
  let addedClueChains: string[] = [];

  const getClueChains = () => {
    return addedClueChains;
  };

  const addClueChains = tool(
    async (args: {
      direction: string;
      clueChains: string[];
    }): Promise<string> => {
      const murder = await db.query.murders.findFirst({
        where: eq(murders.id, murderId),
      });
      if (!murder) {
        throw new Error("Murder not found");
      }

      // verify against direction
      let result = await verifyOutputAgainstConstraints(
        murderId,
        JSON.stringify(args.clueChains),
        `Verify the clue chains follow the direction: "${args.direction}"`,
      );
      if (!result.valid) {
        console.log("❌ Invalid direction:");
        console.log("   reason:", result.reason);
        console.log("   clue chains:", args.clueChains);
        console.log("");
        return `RETRY: ${result.reason}`;
      }

      // verify against murder details
      result = await verifyOutputAgainstConstraints(
        murderId,
        JSON.stringify(args.clueChains),
        `Verify the clue chains follow make sense in the context of the murder details and its clues. Note that 
        new people may be added to the murder investigation through the clue chains.
        
        Murder details: ${JSON.stringify(murder)}
        `,
      );
      if (!result.valid) {
        console.log("❌ Invalid inconsistent with murder details:");
        console.log("   reason:", result.reason);
        console.log("   clue chains:", args.clueChains);
        console.log("");
        return `RETRY: ${result.reason}`;
      }

      // verify constraints
      result = await verifyOutputAgainstConstraints(
        murderId,
        JSON.stringify(args.clueChains),
        fs.readFileSync(
          path.join(
            process.cwd(),
            "src/services/agents/story/clue/prompt/clue_chains_constraints.md",
          ),
          "utf8",
        ),
      );
      if (!result.valid) {
        console.log("❌ Invalid constraints:");
        console.log("   reason:", result.reason);
        console.log("   clue chains:", args.clueChains);
        console.log("");
        return `RETRY: ${result.reason}`;
      }
      addedClueChains = args.clueChains;
      return "success";
    },
    {
      name: "addClueChains",
      description: "Add clue chains to the murder",
      schema: z.object({
        direction: z.string(),
        clueChains: z.array(
          z
            .string()
            .describe(
              "A description of a clue or list of clues representing a chain of leads and information that may be relevant to the murder.",
            ),
        ),
      }),
    },
  );

  return {
    addClueChains,
    getClueChains,
  };
};

export const getClueChainsToGenerate = async (
  murderId: number,
  direction: string,
  numberOfClues: number,
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

  const { addClueChains, getClueChains } = getAddClueChainsTool(murderId);

  const agent = createReactAgent({
    llm: new ChatOpenAI({
      model: "o4-mini",
      openAIApiKey: process.env.OPENAI_API_KEY,
    }),
    tools: [addClueChains],
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
      `Generate {numberOfClues} clue chains for the murder. Call the tool "addClueChains" to add the clue chains to the murder. The clue chains should be relevant to the murder and the direction.
      
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
        "src/services/agents/story/clue/prompt/clue_chains_constraints.md",
      ),
      "utf8",
    ),
    numberOfClues: numberOfClues * 2,
  });

  await callWithRetry(async () =>
    agent.invoke({ messages: formattedPrompt }, { recursionLimit: 100 }),
  );

  // randomly select numberOfClues clue chains
  const selectedClueChains = getClueChains()
    .sort(() => Math.random() - 0.5)
    .slice(0, numberOfClues);

  return selectedClueChains;
};
