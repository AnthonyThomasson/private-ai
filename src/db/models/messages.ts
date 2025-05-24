import { relations } from "drizzle-orm";
import { InferSelectModel } from "drizzle-orm";
import { InferInsertModel } from "drizzle-orm";
import { int, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { people } from "./people";

export type Message = InferSelectModel<typeof messages> & {};
export type NewMessage = InferInsertModel<typeof messages>;
export const messages = sqliteTable("messages", {
  id: int("id").primaryKey(),
  content: text("content").notNull(),
  createdAt: int("created_at").notNull(),
  updatedAt: int("updated_at").notNull(),
  senderId: int("sender_id").references(() => people.id),
  receiverId: int("receiver_id").references(() => people.id),
});
export const messagesRelations = relations(messages, ({ one }) => ({
  sender: one(people, {
    fields: [messages.senderId],
    references: [people.id],
  }),
  receiver: one(people, {
    fields: [messages.receiverId],
    references: [people.id],
  }),
}));
