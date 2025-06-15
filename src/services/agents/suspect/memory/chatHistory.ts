// import {
//   AIMessage,
//   HumanMessage,
//   SystemMessage,
// } from "@langchain/core/messages";
// import { db } from "@/db"; // drizzle db client
// import { ChatMessageRole, chatMessages } from "@/db/models/messages";
// import { eq } from "drizzle-orm";
// import { BaseChatMessageHistory } from "@langchain/core/chat_history";

// export class ChatMessageHistory extends BaseChatMessageHistory {
//   lc_namespace = ["langchain", "chat_history"];
//   lc_serializable = true;
//   lc_kwargs = {};
//   lc_runnable = true;
//   lc_graph = true;
//   lc_graph_name = "ChatMessageHistory";
//   lc_graph_description = "Chat message history";

//   constructor(public sessionId: string) {
//     super({ sessionId: sessionId });
//   }

//   async getMessages(): Promise<AIMessage[] | HumanMessage[] | SystemMessage[]> {
//     const rows = await db
//       .select()
//       .from(chatMessages)
//       .where(eq(chatMessages.sessionId, this.sessionId))
//       .orderBy(chatMessages.createdAt);

//     return rows.map((row) => {
//       if (row.role === ChatMessageRole.ASSISTANT) {
//         return new AIMessage(row.content);
//       } else if (row.role === ChatMessageRole.USER) {
//         return new HumanMessage(row.content);
//       } else {
//         return new SystemMessage(row.content);
//       }
//     });
//   }

//   async addMessage(message: AIMessage | HumanMessage | SystemMessage) {
//     try {
//       await db.insert(chatMessages).values({
//         sessionId: this.sessionId,
//         role:
//           message instanceof AIMessage
//             ? ChatMessageRole.ASSISTANT
//             : message instanceof HumanMessage
//               ? ChatMessageRole.USER
//               : ChatMessageRole.ASSISTANT,
//         content: String(message.content),
//         createdAt: new Date(),
//       });
//     } catch (error) {
//       console.error(error);
//     }
//   }

//   async clear() {
//     await db
//       .delete(chatMessages)
//       .where(eq(chatMessages.sessionId, this.sessionId));
//   }

//   async addUserMessage(message: string) {
//     await this.addMessage(new HumanMessage(message));
//   }

//   async addAIChatMessage(message: string) {
//     await this.addMessage(new AIMessage(message));
//   }
// }
