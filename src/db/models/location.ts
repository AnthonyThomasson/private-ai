import { InferSelectModel, relations } from "drizzle-orm";
import { InferInsertModel } from "drizzle-orm";
import { int, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { murders } from "./murders";

export type Location = InferSelectModel<typeof locations> & {
  murder: InferSelectModel<typeof murders>;
};
export type NewLocation = InferInsertModel<typeof locations>;
export const locations = sqliteTable("locations", {
  id: int("id").primaryKey(),
  address: text("address").notNull(),
  description: text("description").notNull(),
  murderId: int("murder_id"),
});

export const locationRelations = relations(locations, ({ one }) => ({
  murder: one(murders, {
    fields: [locations.murderId],
    references: [murders.id],
    relationName: "murder",
  }),
}));
