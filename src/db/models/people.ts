import { InferSelectModel, relations } from "drizzle-orm";

import { InferInsertModel } from "drizzle-orm";
import { int, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { murders } from "./murders";
import { locations } from "./location";
import { clueLinks } from "./clueLink";

export type Person = InferSelectModel<typeof people> & {
  location: InferSelectModel<typeof locations>;
};
export type NewPerson = InferInsertModel<typeof people>;
export const people = sqliteTable("people", {
  id: int("id").primaryKey(),
  name: text("name").notNull(),
  age: int("age"),
  gender: text("gender", { enum: ["male", "female"] }).notNull(),
  occupation: text("occupation"),
  description: text("description"),
  personality: text("personality"),
  image: text("image"),

  murderId: int("murder_id").references(() => murders.id),
  locationId: int("location_id").references(() => locations.id),
});

export const peopleRelations = relations(people, ({ one, many }) => ({
  location: one(locations, {
    fields: [people.locationId],
    references: [locations.id],
  }),
  murder: one(murders, {
    fields: [people.murderId],
    references: [murders.id],
    relationName: "murder",
  }),
  clueLinks: many(clueLinks),
}));
