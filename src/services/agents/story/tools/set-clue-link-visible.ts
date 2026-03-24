import { db } from "@/db";
import { clueLinks } from "@/db/models/clueLink";
import { tool } from "@langchain/core/tools";
import { eq } from "drizzle-orm";
import { z } from "zod";

export const createSetClueLinkVisibleTool = () =>
  tool(
    async ({
      clueLinkId,
      visible,
    }: {
      clueLinkId: number;
      visible: boolean;
    }) => {
      await db
        .update(clueLinks)
        .set({ isVisible: visible ? 1 : 0 })
        .where(eq(clueLinks.id, clueLinkId));
      console.log(`👁️  Clue link ${clueLinkId} visibility set to ${visible}`);
      return "success";
    },
    {
      name: "set_clue_link_visible",
      description:
        "Mark a clue link as visible (true) or hidden (false). Use to fix incorrect visibility — only the 1–2 initial crime-scene clue links should be visible.",
      schema: z.object({
        clueLinkId: z.number().describe("The clueLinkId to update"),
        visible: z
          .union([z.boolean(), z.number()])
          .transform((v) => Boolean(v))
          .describe("true/1 = visible at crime scene, false/0 = hidden"),
      }),
    },
  );
