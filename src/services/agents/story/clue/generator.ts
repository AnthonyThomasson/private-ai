import { db } from "@/db";
import { murders } from "@/db/models/murders";
import { eq } from "drizzle-orm";
import { clueLinks } from "@/db/models/clueLink";
import { getClueChainsToGenerate } from "./thinker";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { getTools } from "./tools";
import path from "path";
import fs from "fs";

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

  console.log("🧪 Generating initial clues");
  console.log("");

  await generatClues(
    murderId,
    `Create clues based on forensic evidence in the murder scene. The clues should not incriminate the perpetrator, 
    but should be leads to leads to more information about the murder, including possible witnesses or individuals 
    may know more about what happened.`,
    2,
  );

  await db
    .update(clueLinks)
    .set({
      isVisible: 1,
    })
    .where(eq(clueLinks.murderId, murderId));

  // console.log("🗣️ Generating rumors");
  // console.log("");

  // await generatClues(
  //   murderId,
  //   `generate false leads and rumors about the murder. Each rumor should also contain additional connection disproving
  //   the rumor through witness statements or other evidence that could be obtained though interrogating additional people.`,
  //   Math.floor(Math.random() * 6) + 3,
  // );

  console.log("🚔 Generating incriminating clues");
  console.log("");

  await generatClues(
    murderId,
    `generate clues incriminating the perpetrator. Although the leads can contain aditional suspects and clues, they should be 
    connected to at least one existing clue.The clues NEED to be retrievable through the interrogation of the perpetrator or other 
    suspects, and not by any physical investigation. Clues should should be connected to some existing suspects so that uncovering 
    them is possible.
    
    # PERPETRATOR
    ${JSON.stringify(murder.perpetrator)}`,
    1,
  );
};

export const generatClues = async (
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

  if (!murder) {
    throw new Error("Murder not found");
  }

  const cluesChainsToGenerate = await getClueChainsToGenerate(
    murder.id,
    direction,
    numberOfClues,
  );

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
    clueChains: cluesChainsToGenerate,
    create_clue: "create_clue",
  });

  const agent = createReactAgent({
    llm: new ChatOpenAI({
      model: "o4-mini",
      openAIApiKey: process.env.OPENAI_API_KEY,
    }),
    tools: [createClue],
  });

  await agent.invoke({ messages: formattedPrompt });
};
