import { InferSelectModel, relations } from "drizzle-orm";
import { int, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { locations } from "./location";
import { people } from "./people";
import { clues } from "./clues";
import { clueLinks } from "./clueLink";

export const murders = sqliteTable("murders", {
  id: int("id").primaryKey(),
  description: text("description").notNull(),
  locationId: int("location_id").references(() => locations.id),
  victimId: int("victim_id"),
  perpetratorId: int("perpetrator_id"),
});

export const murdersRelations = relations(murders, ({ one, many }) => ({
  location: one(locations, {
    fields: [murders.locationId],
    references: [locations.id],
  }),
  people: many(people, {
    relationName: "murder",
  }),
  victim: one(people, {
    fields: [murders.victimId],
    references: [people.id],
    relationName: "victim",
  }),
  perpetrator: one(people, {
    fields: [murders.perpetratorId],
    references: [people.id],
    relationName: "perpetrator",
  }),
  clueLinks: many(clueLinks),
}));

export type Murder = InferSelectModel<typeof murders> & {
  location: InferSelectModel<typeof locations>;
  people: InferSelectModel<typeof people>[];
  victim: InferSelectModel<typeof people>;
  perpetrator: InferSelectModel<typeof people>;
  clues: InferSelectModel<typeof clues>[];
};
