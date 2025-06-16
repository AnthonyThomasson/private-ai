import { db } from "@/db";
import { people, Person } from "@/db/models/people";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
import { MemorySaver } from "@langchain/langgraph";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";
import { eq } from "drizzle-orm";
import fs from "fs";
import path from "path";
import { ChatMessageHistory } from "./memory/chatHistory";
import { cookies } from "next/headers";

export const processMessage = async (suspectId: number, message: string) => {
  const suspect = (await db.query.people.findFirst({
    where: eq(people.id, suspectId),
    with: {
      murder: true,
      location: true,
      clueLinks: {
        with: {
          clue: true,
        },
      },
    },
  })) as Person;

  if (!suspect) {
    throw new Error("Suspect not found");
  }

  const userToken = (await cookies()).get("user_token")?.value;
  if (!userToken) {
    throw new Error("User token not found");
  }

  const chatHistory = new ChatMessageHistory(suspect, userToken);
  await chatHistory.addUserMessage(message);

  const promptTemplate = ChatPromptTemplate.fromMessages([
    [
      "system",
      fs.readFileSync(
        path.join(
          process.cwd(),
          "src/services/agents/suspect/prompt",
          "interview.md",
        ),
        "utf8",
      ),
    ],
    new MessagesPlaceholder("chat_history"),
    ["human", "{input}"],
  ]);

  const formattedPrompt = await promptTemplate.formatMessages({
    chat_history: await chatHistory.getMessages(),
    input: message,
    clue_links: JSON.stringify(suspect.clueLinks),
    person_profile: JSON.stringify(suspect),
    murder_details: JSON.stringify(suspect.murder),
    location_details: JSON.stringify(suspect.location),
    constraints: fs.readFileSync(
      path.join(
        process.cwd(),
        "src/services/agents/suspect/prompt",
        "constraints.md",
      ),
    ),
  });

  const encoder = new TextEncoder();

  let fullResponse = "";
  const stream = new ReadableStream({
    async start(controller) {
      const model = new ChatOpenAI({
        model: "gpt-4.1-mini",
        openAIApiKey: process.env.OPENAI_API_KEY,
        streaming: true,
        callbacks: [
          {
            handleLLMNewToken(token: string) {
              fullResponse += token;
              controller.enqueue(encoder.encode(token));
            },
            async handleLLMEnd() {
              chatHistory.addAIChatMessage(fullResponse);
              controller.close();
            },
            handleLLMError(err) {
              controller.enqueue(encoder.encode(`[ERROR]: ${err.message}`));
              controller.close();
            },
          },
        ],
      });

      const agentCheckpointer = new MemorySaver();
      const agent = createReactAgent({
        llm: model,
        tools: [],
        checkpointSaver: agentCheckpointer,
      });

      await agent.invoke({ messages: formattedPrompt });
    },
  });

  return stream;
};
