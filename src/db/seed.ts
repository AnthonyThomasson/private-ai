import { db } from "@/db";
import { generateMurder } from "@/services/agents/story";
import { sql } from "drizzle-orm";

export const seed = async () => {
  console.log("🌱 Clearing database...");
  // Disable FK checks to allow bulk deletion regardless of FK order
  await db.run(sql`PRAGMA foreign_keys = OFF`);
  await db.run(sql`DELETE FROM clue_links`);
  await db.run(sql`DELETE FROM clues`);
  await db.run(sql`DELETE FROM messages`);
  await db.run(sql`DELETE FROM people`);
  await db.run(sql`DELETE FROM locations`);
  await db.run(sql`DELETE FROM murders`);
  await db.run(sql`PRAGMA foreign_keys = ON`);

  console.log("🌱 Seeding database...");
  await generateMurder();
};

seed().catch(console.error);
