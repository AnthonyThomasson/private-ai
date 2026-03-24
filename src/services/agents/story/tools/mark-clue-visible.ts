import { db } from "@/db";
import { clueLinks } from "@/db/models/clueLink";
import { tool } from "@langchain/core/tools";
import { eq } from "drizzle-orm";
import { z } from "zod";

/** Creates a tool that marks a clue link as visible at the initial crime scene. */
export const createMarkClueVisibleTool = () =>
  tool(
    async ({ clueLinkId }: { clueLinkId: number }) => {
      await db
        .update(clueLinks)
        .set({ isVisible: 1 })
        .where(eq(clueLinks.id, clueLinkId));
      return "success";
    },
    {
      name: "mark_clue_visible",
      description:
        "Mark a clue link as visible at the initial crime scene. Use for physical evidence found at the scene.",
      schema: z.object({
        clueLinkId: z
          .number()
          .describe(
            "The clueLinkId returned by create_clue to mark as visible",
          ),
      }),
    },
  );
