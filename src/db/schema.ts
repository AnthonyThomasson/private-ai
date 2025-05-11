import { InferInsertModel, relations } from "drizzle-orm";
import { InferSelectModel } from "drizzle-orm";
import { int, sqliteTable, text } from "drizzle-orm/sqlite-core";

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

export type Location = InferSelectModel<typeof locations> & {};
export type NewLocation = InferInsertModel<typeof locations>;
export const locations = sqliteTable("locations", {
  id: int("id").primaryKey(),
  address: text("address").notNull(),
  description: text("description"),
});

export type PersonRelationship = InferSelectModel<
  typeof personRelationships
> & {};
export type NewPersonRelationship = InferInsertModel<
  typeof personRelationships
>;
export const personRelationships = sqliteTable("person_relationships", {
  id: int("id").primaryKey(),
  person1Id: int("person1_id").references(() => people.id),
  person2Id: int("person2_id").references(() => people.id),
  relationshipType: text("relationship_type").notNull(),
});

export type Person = InferSelectModel<typeof people> & {};
export type NewPerson = InferInsertModel<typeof people>;
export const people = sqliteTable("people", {
  id: int("id").primaryKey(),
  name: text("name").notNull(),
  age: int("age"),
  gender: text("gender", { enum: ["male", "female"] }).notNull(),
  occupation: text("occupation"),
  description: text("description"),
  personality: text("personality"),
});

export const murders = sqliteTable("murders", {
  id: int("id").primaryKey(),
  description: text("description").notNull(),
  victimId: int("victim_id").references(() => people.id),
  perpetratorId: int("perpetrator_id").references(() => people.id),
  locationId: int("location_id").references(() => locations.id),
});
export const murdersRelations = relations(murders, ({ one, many }) => ({
  victim: one(people, {
    fields: [murders.victimId],
    references: [people.id],
  }),
  perpetrator: one(people, {
    fields: [murders.perpetratorId],
    references: [people.id],
  }),
  clues: many(clues, {
    relationName: "clues",
  }),
}));
export type Murder = InferSelectModel<typeof murders> & {
  victim: InferSelectModel<typeof people>;
  perpetrator: InferSelectModel<typeof people>;
  clues: InferSelectModel<typeof clues>[];
};

export type Clue = InferSelectModel<typeof clues> & {};
export type NewClue = InferInsertModel<typeof clues>;
export const clues = sqliteTable("clues", {
  id: int("id").primaryKey(),
  murderId: int("murder_id").references(() => murders.id),
  description: text("description").notNull(),
});

export type Evidence = InferSelectModel<typeof evidences> & {};
export type NewEvidence = InferInsertModel<typeof evidences>;
export const evidences = sqliteTable("evidences", {
  id: int("id").primaryKey(),
  description: text("description").notNull(),
  incriminationRating: int("incrimination_rating"),
  known: int("known", { mode: "boolean" }),
  suspectId: int("suspect_id").references(() => people.id),
  locationId: int("location_id").references(() => locations.id), // Reference to locations
});

export type EvidenceRelationship = InferSelectModel<
  typeof evidenceRelationships
> & {};
export type NewEvidenceRelationship = InferInsertModel<
  typeof evidenceRelationships
>;
export const evidenceRelationships = sqliteTable("evidence_relationships", {
  id: int("id").primaryKey(),
  evidenceId: int("evidence_id").references(() => evidences.id),
  murderId: int("murder_id").references(() => murders.id),
  reporterId: int("reporter_id").references(() => people.id),
  known: int("known", { mode: "boolean" }),
});

export const schema = {
  people,
  personRelationships,
  locations,
  evidences,
  evidenceRelationships,
  murders,
  murdersRelations,
  clues,
  messages,
  messagesRelations,
};
