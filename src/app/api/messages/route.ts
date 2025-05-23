import { sendMessage } from "@/services/message";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { MemorySaver } from "@langchain/langgraph";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";

export async function POST(req: Request) {
  const { message, senderId, receiverId } = await req.json();

  await sendMessage(message, senderId, receiverId);

  const promptTemplate = ChatPromptTemplate.fromMessages([
    ["system", "you are a person in a crime thing"],
    ["human", "{input}"],
  ]);

  const formattedPrompt = await promptTemplate.formatMessages({
    input: message,
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
              console.log("fullResponse", fullResponse);
              await sendMessage(fullResponse, receiverId, senderId);
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
          configurable: { thread_id: receiverId.id },
        },
      );
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}
