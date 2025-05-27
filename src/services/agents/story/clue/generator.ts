import { db } from "@/db";
import { murders } from "@/db/models/murders";
import { ChatOpenAI } from "@langchain/openai";
import { eq } from "drizzle-orm";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import fs from "fs";
import path from "path";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { getTools } from "./tools";

export const generateCluesFromMurder = async (murderId: number) => {
  const murder = await db.query.murders.findFirst({
    where: eq(murders.id, murderId),
    with: {
      victim: true,
    },
  });

  if (!murder) {
    throw new Error("Murder not found");
  }

  const { createClue, createPerson, linkPersonToClue } = getTools(murder.id);

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
    ["human", "{input}"],
  ]);

  const formattedPrompt = await promptTemplate.formatMessages({
    input: {
      murder_details: murder.description,
      victim: JSON.stringify(murder.victim),
    },
    constraints: fs.readFileSync(
      path.join(
        process.cwd(),
        "src/services/agents/story/clue/prompt",
        "constraints.md",
      ),
      "utf8",
    ),
    create_clue: "create_clue",
    create_person: "create_person",
    link_person_to_clue: "link_person_to_clue",
  });

  const agent = createReactAgent({
    llm: new ChatOpenAI({
      model: "o4-mini",
      openAIApiKey: process.env.OPENAI_API_KEY,
    }),
    tools: [createClue, createPerson, linkPersonToClue],
  });

  await agent.invoke({ messages: formattedPrompt }, { recursionLimit: 200 });
};
