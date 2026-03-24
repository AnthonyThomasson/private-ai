import { db } from "@/db";
import { murders } from "@/db/models/murders";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

export const createCreateMurderSceneTool = (
  setMurderId: (id: number) => void,
) =>
  tool(
    async ({ description }: { description: string }) => {
      const [murder] = await db
        .insert(murders)
        .values({ description })
        .returning();
      setMurderId(murder.id);
      console.log("🔪 Murder scene created:", description);
      return JSON.stringify({ murderId: murder.id });
    },
    {
      name: "create_murder_scene",
      description:
        "Create the murder scene with a crime description. Call this first.",
      schema: z.object({
        description: z
          .string()
          .describe(
            "A 1-sentence description of the crime scene including cause of death. No names. No sci-fi.",
          ),
      }),
    },
  );
