import { relations } from "drizzle-orm";
import { InferSelectModel } from "drizzle-orm";
import { InferInsertModel } from "drizzle-orm";
import { int, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { people } from "./people";
import { murders } from "./murders";

export enum ChatMessageRole {
  USER = "user",
  AI = "ai",
}
export type Message = InferSelectModel<typeof messages> & {};
export type NewMessage = InferInsertModel<typeof messages>;
export const messages = sqliteTable("messages", {
  id: int("id").primaryKey(),
  createdAt: int("created_at").notNull(),
  updatedAt: int("updated_at").notNull(),
  role: text("role").notNull(),
  content: text("content").notNull(),
  murderId: int("murder_id").references(() => murders.id),
  suspectId: int("suspect_id").references(() => people.id),
  userToken: text("user_token").notNull(),
});
export const messagesRelations = relations(messages, ({ one }) => ({
  murder: one(murders, {
    fields: [messages.murderId],
    references: [murders.id],
  }),
  suspect: one(people, {
    fields: [messages.suspectId],
    references: [people.id],
  }),
}));
