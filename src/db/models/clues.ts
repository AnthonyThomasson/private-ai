import { InferInsertModel, relations } from "drizzle-orm";

import { InferSelectModel } from "drizzle-orm";
import { int, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { murders } from "./murders";
import { clueLinks } from "./clueLink";

export type Clue = InferSelectModel<typeof clues>;
export type NewClue = InferInsertModel<typeof clues>;
export const clues = sqliteTable("clues", {
  id: int("id").primaryKey(),
  murderId: int("murder_id").references(() => murders.id),
  description: text("description").notNull(),
});
export const cluesRelations = relations(clues, ({ one, many }) => ({
  murder: one(murders, {
    fields: [clues.murderId],
    references: [murders.id],
  }),
  clueLinks: many(clueLinks),
}));
