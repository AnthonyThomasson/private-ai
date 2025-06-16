import {
  AIMessage,
  HumanMessage,
  SystemMessage,
} from "@langchain/core/messages";
import { db } from "@/db"; // drizzle db client
import { ChatMessageRole, messages } from "@/db/models/messages";
import { and, eq } from "drizzle-orm";
import { BaseChatMessageHistory } from "@langchain/core/chat_history";
import { Person } from "@/db/models/people";

export class ChatMessageHistory extends BaseChatMessageHistory {
  lc_namespace = ["langchain", "chat_history"];
  lc_serializable = true;
  lc_kwargs = {};
  lc_runnable = true;
  lc_graph = true;
  lc_graph_name = "ChatMessageHistory";
  lc_graph_description = "Chat message history";

  constructor(
    public suspect: Person,
    public userToken: string,
  ) {
    super({ sessionId: `${suspect.id}-${suspect.murderId}-${userToken}` });
  }

  async getMessages(): Promise<AIMessage[] | HumanMessage[] | SystemMessage[]> {
    const rows = await db
      .select()
      .from(messages)
      .where(
        and(
          eq(messages.suspectId, this.suspect.id),
          eq(messages.userToken, this.userToken),
        ),
      )
      .orderBy(messages.createdAt);

    return rows.map((row) => {
      if (row.role === ChatMessageRole.AI) {
        return new AIMessage(row.content);
      } else if (row.role === ChatMessageRole.USER) {
        return new HumanMessage(row.content);
      } else {
        return new SystemMessage(row.content);
      }
    });
  }

  async addMessage(message: AIMessage | HumanMessage | SystemMessage) {
    try {
      await db.insert(messages).values({
        suspectId: this.suspect.id,
        murderId: this.suspect.murderId,
        userToken: this.userToken,
        role:
          message instanceof AIMessage
            ? ChatMessageRole.AI
            : message instanceof HumanMessage
              ? ChatMessageRole.USER
              : ChatMessageRole.AI,
        content: String(message.content),
        createdAt: new Date().getTime(),
        updatedAt: new Date().getTime(),
      });
    } catch (error) {
      console.error(error);
    }
  }

  async clear() {
    await db.delete(messages).where(eq(messages.suspectId, this.suspect.id));
  }

  async addUserMessage(message: string) {
    await this.addMessage(new HumanMessage(message));
  }

  async addAIChatMessage(message: string) {
    await this.addMessage(new AIMessage(message));
  }
}
