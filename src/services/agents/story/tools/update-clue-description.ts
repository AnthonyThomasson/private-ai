import { db } from "@/db";
import { clues } from "@/db/models/clues";
import { tool } from "@langchain/core/tools";
import { eq } from "drizzle-orm";
import { z } from "zod";

export const createUpdateClueDescriptionTool = () =>
  tool(
    async ({
      clueId,
      description,
    }: {
      clueId: number;
      description: string;
    }) => {
      await db.update(clues).set({ description }).where(eq(clues.id, clueId));
      console.log(`✏️  Clue ${clueId} description updated`);
      return "success";
    },
    {
      name: "update_clue_description",
      description:
        "Rewrite a clue's description text. Use to remove the perpetrator's name if it was accidentally included.",
      schema: z.object({
        clueId: z.number().describe("The clueId to update"),
        description: z
          .string()
          .describe(
            "The corrected clue description — must not contain the perpetrator's name",
          ),
      }),
    },
  );
