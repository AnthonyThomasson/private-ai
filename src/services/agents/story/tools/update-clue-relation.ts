import { db } from "@/db";
import { clueLinks } from "@/db/models/clueLink";
import { tool } from "@langchain/core/tools";
import { eq } from "drizzle-orm";
import { z } from "zod";

export const createUpdateClueRelationTool = () =>
  tool(
    async ({
      clueLinkId,
      relation,
    }: {
      clueLinkId: number;
      relation: string;
    }) => {
      await db
        .update(clueLinks)
        .set({ description: relation })
        .where(eq(clueLinks.id, clueLinkId));
      console.log(`✏️  Clue link ${clueLinkId} relation updated`);
      return "success";
    },
    {
      name: "update_clue_relation",
      description:
        "Rewrite a clue link's relation text. Use to remove the perpetrator's name if it was accidentally included.",
      schema: z.object({
        clueLinkId: z.number().describe("The clueLinkId to update"),
        relation: z
          .string()
          .describe(
            "The corrected relation text — must not contain the perpetrator's name",
          ),
      }),
    },
  );
