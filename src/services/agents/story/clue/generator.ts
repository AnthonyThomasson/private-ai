import { db } from "@/db";
import { murders } from "@/db/models/murders";
import { eq } from "drizzle-orm";
import { clueLinks } from "@/db/models/clueLink";
import { getClueChainToGenerate } from "./thinker";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { getTools } from "./tools";
import path from "path";
import fs from "fs";
import { z } from "zod";
import { tool } from "@langchain/core/tools";

const markClueVisible = tool(
  async ({ clueLinkId }: { clueLinkId: number }) => {
    await db
      .update(clueLinks)
      .set({ isVisible: 1 })
      .where(eq(clueLinks.id, clueLinkId));

    return "success";
  },
  {
    name: "markClueVisible",
    description: "Mark a clue link as visible",
    schema: z.object({
      clueLinkId: z
        .number()
        .describe("The id of the clue link to mark as visible"),
    }),
  },
);

export const generateCluesFromMurder = async (murderId: number) => {
  const murder = await db.query.murders.findFirst({
    where: eq(murders.id, murderId),
    with: {
      victim: true,
      perpetrator: true,
    },
  });

  if (!murder) {
    throw new Error("Murder not found");
  }

  console.log("🚔 Generating clues");
  console.log("");

  await generatClues(
    murderId,
    `generate a chain of 3 clues related to the murder. Each clue should lead to the next in a logical chain.
    The clues should be connected by some common person that is not the victim or perpetrator.

    The first clue should be forensic evidence mentioning a detail that could be used to 
    identify the perpetrator. It should NOT mention the perpetrator directly, but point to a
    new person that could provide more information. The clue should be connected to the murder
    scene.

    The second clue should mention the person who was referenced from the first clue, and
    again not mention the perpetrator directly, but point to a new person that can further provide
    infomration about the crime.

    The third clue should mention the person who was referenced in the second second clue, and identify some
    possible suspects, one of which is the perpetrator.

    Each clue should be connected by some common person that is not the victim or perpetrator.
    Each clue should mention more than one person.
    
    # Crime Scene
    ${murder.description}

    # PERPETRATOR
    ${JSON.stringify(murder.perpetrator)}`,
  );

  await markVisableClues(murderId);
};

const markVisableClues = async (murderId: number) => {
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

  const agent = createReactAgent({
    llm: new ChatOpenAI({
      model: "gpt-4.1-mini",
      openAIApiKey: process.env.OPENAI_API_KEY,
    }),
    tools: [markClueVisible],
  });

  await agent.invoke(
    {
      messages: `Call the tool 'markClueVisible' to identify the clue links related to the physical crime scene.
        
        # Crime Scene
        ${murder.description}

        # CLUE LINKS
        ${JSON.stringify(murder.clueLinks)}
        `,
    },
    { recursionLimit: 100 },
  );
};

export const generatClues = async (murderId: number, direction: string) => {
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

  if (!murder) {
    throw new Error("Murder not found");
  }

  const cluesChainToGenerate = await getClueChainToGenerate(
    murder.id,
    direction,
  );

  console.log("⛓️‍💥 Clue Chain:");
  console.log(cluesChainToGenerate);
  console.log();

  const { createClue } = getTools(murder.id);

  const promptTemplate = ChatPromptTemplate.fromMessages([
    [
      "system",
      fs.readFileSync(
        path.join(
          process.cwd(),
          "src/services/agents/story/clue/prompt",
          "generator.md",
        ),
        "utf8",
      ),
    ],
    ["human", "{clueChains}"],
  ]);

  const formattedPrompt = await promptTemplate.formatMessages({
    clueChains: cluesChainToGenerate,
    create_clue: "create_clue",
  });

  const agent = createReactAgent({
    llm: new ChatOpenAI({
      model: "gpt-4.1-mini",
      openAIApiKey: process.env.OPENAI_API_KEY,
    }),
    tools: [createClue],
  });

  await agent.invoke({ messages: formattedPrompt }, { recursionLimit: 100 });
};
