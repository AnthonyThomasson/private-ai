import { generateMurder } from "@/services/agents/story/murder/murder";
import { db } from ".";

export const seed = async () => {
  console.log("🌱 Seeding database...");
  const existingMurder = await db.query.murders.findFirst();
  if (existingMurder) {
    console.log("🌱 Database already seeded");
    return;
  }

  await generateMurder();
};

seed().catch(console.error);
