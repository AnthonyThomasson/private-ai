/* eslint-disable @typescript-eslint/no-explicit-any */
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { MemorySaver } from "@langchain/langgraph";
import { model } from "../model";
import fs from "fs";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";

const addClue = new DynamicStructuredTool({
  name: "add_clue",
  description: "Adds a new clue to the murder investigation",
  schema: z.object({
    name: z.string(),
    details: z.string(),
  }),
  func: async ({ name, details }) => {
    console.log(`Clue added: ${name} - ${details}`);
    return ``;
  },
});

const agentCheckpointer = new MemorySaver();
const agent = createReactAgent({
  llm: model,
  tools: [addClue],
  checkpointSaver: agentCheckpointer,
});

const prompt = fs.readFileSync("src/services/agents/promp_suspect.md", "utf8");

const promptTemplate = ChatPromptTemplate.fromMessages([
  ["system", prompt],
  ["human", "{input}"],
]);

export const chat = async (
  input: string,
  characterProfile: { name: any },
  murderProfile: any,
  locationProfile: any,
) => {
  const formattedPrompt = await promptTemplate.formatMessages({
    input: input,
    character_profile: JSON.stringify(characterProfile),
    murder_details: JSON.stringify(murderProfile),
    location_details: JSON.stringify(locationProfile),
  });

  return await agent.invoke(
    {
      messages: formattedPrompt,
    },
    {
      configurable: { thread_id: characterProfile.name },
    },
  );
};
