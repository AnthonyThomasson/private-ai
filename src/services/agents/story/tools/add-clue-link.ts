import { db } from "@/db";
import { clueLinks } from "@/db/models/clueLink";
import { people } from "@/db/models/people";
import { tool } from "@langchain/core/tools";
import { eq } from "drizzle-orm";
import { z } from "zod";

/** Creates a tool that adds a link from an existing clue to a person. */
export const createAddClueLinkTool = (murderId: number) =>
  tool(
    async ({
      clueId,
      personId,
      relation,
    }: {
      clueId: number;
      personId: number;
      relation: string;
    }) => {
      const person = await db.query.people.findFirst({
        where: eq(people.id, personId),
      });
      if (!person) {
        return `RETRY: personId ${personId} does not exist.`;
      }
      const [link] = await db
        .insert(clueLinks)
        .values({ murderId, clueId, personId, description: relation })
        .returning();
      console.log(`➕ Added clue link: clue ${clueId} → person ${personId}`);
      return JSON.stringify({ clueLinkId: link.id });
    },
    {
      name: "add_clue_link",
      description:
        "Add a new link from an existing clue to a person. Use when a clue needs to connect to a person it currently doesn't link to.",
      schema: z.object({
        clueId: z.number().describe("The clueId to add a link for"),
        personId: z.number().describe("The personId to link to"),
        relation: z
          .string()
          .describe(
            "What this person knows about or how they connect to this clue",
          ),
      }),
    },
  );
