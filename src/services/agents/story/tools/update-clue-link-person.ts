import { db } from "@/db";
import { clueLinks } from "@/db/models/clueLink";
import { people } from "@/db/models/people";
import { tool } from "@langchain/core/tools";
import { eq } from "drizzle-orm";
import { z } from "zod";

/** Creates a tool that rewires a clue link to point to a different person. */
export const createUpdateClueLinkPersonTool = () =>
  tool(
    async ({
      clueLinkId,
      newPersonId,
    }: {
      clueLinkId: number;
      newPersonId: number;
    }) => {
      const person = await db.query.people.findFirst({
        where: eq(people.id, newPersonId),
      });
      if (!person) {
        return `RETRY: personId ${newPersonId} does not exist.`;
      }
      await db
        .update(clueLinks)
        .set({ personId: newPersonId })
        .where(eq(clueLinks.id, clueLinkId));
      console.log(
        `🔗 Clue link ${clueLinkId} rewired to person ${newPersonId}`,
      );
      return "success";
    },
    {
      name: "update_clue_link_person",
      description:
        "Rewire an existing clue link to point to a different person. Use when a link points to the wrong person in the chain.",
      schema: z.object({
        clueLinkId: z.number().describe("The clueLinkId to rewire"),
        newPersonId: z
          .number()
          .describe("The personId this link should now point to"),
      }),
    },
  );
