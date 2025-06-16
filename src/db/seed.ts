import { generateMurder } from "@/services/agents/story/murder/murder";

export const seed = async () => {
  console.log("🌱 Seeding database...");
  await generateMurder();
};

seed().catch(console.error);
