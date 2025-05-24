import { db } from "@/db";
import { people } from "@/db/models/people";
import { getMurderDetails } from "@/services/murder";
import { getPersonProfile } from "@/services/people";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { MemorySaver } from "@langchain/langgraph";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";
import { eq } from "drizzle-orm";
import fs from "fs";
import path from "path";

export const processMessage = async (
  suspectId: number,
  message: string,
  onComplete: (message: string) => void,
) => {
  const murder = await db.query.murders.findFirst();

  if (!murder) {
    throw new Error("Murder not found");
  }

  const suspect = await db.query.people.findFirst({
    where: eq(people.id, suspectId),
  });

  if (!suspect) {
    throw new Error("Suspect not found");
  }

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
    ["human", "{input}"],
  ]);

  const formattedPrompt = await promptTemplate.formatMessages({
    input: message,
    person_profile: getPersonProfile(suspect.id),
    murder_details: getMurderDetails(murder?.id),
    location_details: `A bar named 'The Local'. It's a popular spot for locals and tourists alike. It's a bit run down, but has a cozy feel. It's a bit dark, but has a warm glow. It's a bit loud, but has a cozy feel. It's a bit dark, but has a warm glow.`,
  });

  const encoder = new TextEncoder();

  let fullResponse = "";
  const stream = new ReadableStream({
    async start(controller) {
      const model = new ChatOpenAI({
        model: "o4-mini",
        openAIApiKey: process.env.OPENAI_API_KEY,
        streaming: true,
        callbacks: [
          {
            handleLLMNewToken(token: string) {
              fullResponse += token;
              controller.enqueue(encoder.encode(token));
            },
            async handleLLMEnd() {
              onComplete(fullResponse);
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

      await agent.invoke(
        { messages: formattedPrompt },
        {
          configurable: { thread_id: suspectId.toString() },
        },
      );
    },
  });

  return stream;
};
