import { InferSelectModel } from "drizzle-orm";

import { InferInsertModel } from "drizzle-orm";
import { int, sqliteTable, text } from "drizzle-orm/sqlite-core";

export type Location = InferSelectModel<typeof locations> & {};
export type NewLocation = InferInsertModel<typeof locations>;
export const locations = sqliteTable("locations", {
  id: int("id").primaryKey(),
  address: text("address").notNull(),
  description: text("description").notNull(),
});
