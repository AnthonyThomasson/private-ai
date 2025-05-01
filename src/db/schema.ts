import { InferInsertModel } from "drizzle-orm";
import { InferSelectModel } from "drizzle-orm";
import { int, sqliteTable, text } from "drizzle-orm/sqlite-core";

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

export type Murder = InferSelectModel<typeof murders> & {};
export type NewMurder = InferInsertModel<typeof murders>;
export const murders = sqliteTable("murders", {
  id: int("id").primaryKey(),
  description: text("description").notNull(),
  victimId: int("victim_id").references(() => people.id),
  perpetratorId: int("perpetrator_id").references(() => people.id),
  locationId: int("location_id").references(() => locations.id), // Reference to locations
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
  locations,
  evidences,
  murders,
  evidenceRelationships,
  personRelationships,
};
