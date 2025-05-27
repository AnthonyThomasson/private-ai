import { InferInsertModel, relations } from "drizzle-orm";

import { InferSelectModel } from "drizzle-orm";
import { int, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { people } from "./people";
import { clues } from "./clues";
import { murders } from "./murders";

export type ClueLink = InferSelectModel<typeof clueLinks> & {
  clue: InferSelectModel<typeof clues>;
  person: InferSelectModel<typeof people>;
  murder: InferSelectModel<typeof murders>;
};
export type NewClueLink = InferInsertModel<typeof clueLinks>;
export const clueLinks = sqliteTable("clue_links", {
  id: int("id").primaryKey(),
  description: text("description").notNull(),
  clueId: int("clue_id").references(() => clues.id),
  personId: int("person_id").references(() => people.id),
  murderId: int("murder_id").references(() => murders.id),
  isVisible: int("is_visible").notNull().default(1),
});

export const clueLinksRelations = relations(clueLinks, ({ one }) => ({
  clue: one(clues, {
    fields: [clueLinks.clueId],
    references: [clues.id],
  }),
  person: one(people, {
    fields: [clueLinks.personId],
    references: [people.id],
  }),
  murder: one(murders, {
    fields: [clueLinks.murderId],
    references: [murders.id],
  }),
}));
