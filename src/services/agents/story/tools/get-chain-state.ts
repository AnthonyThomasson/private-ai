import { db } from "@/db";
import { clueLinks } from "@/db/models/clueLink";
import { clues } from "@/db/models/clues";
import { murders } from "@/db/models/murders";
import { people } from "@/db/models/people";
import { tool } from "@langchain/core/tools";
import { eq } from "drizzle-orm";
import { z } from "zod";

/** Creates a tool that returns the full clue-chain state (people, clues, links) for a murder. */
export const createGetChainStateTool = (murderId: number) =>
  tool(
    async () => {
      const allPeople = await db.query.people.findMany({
        where: eq(people.murderId, murderId),
      });
      const allClues = await db.query.clues.findMany({
        where: eq(clues.murderId, murderId),
      });
      const allLinks = await db.query.clueLinks.findMany({
        where: eq(clueLinks.murderId, murderId),
      });
      const murder = await db.query.murders.findFirst({
        where: eq(murders.id, murderId),
      });
      return JSON.stringify({
        murder: {
          id: murder?.id,
          victimId: murder?.victimId,
          perpetratorId: murder?.perpetratorId,
        },
        people: allPeople.map((p) => ({
          personId: p.id,
          name: p.name,
          occupation: p.occupation,
        })),
        clues: allClues.map((c) => ({
          clueId: c.id,
          description: c.description,
        })),
        clueLinks: allLinks.map((l) => ({
          clueLinkId: l.id,
          clueId: l.clueId,
          personId: l.personId,
          relation: l.description,
          isVisible: l.isVisible,
        })),
      });
    },
    {
      name: "get_chain_state",
      description:
        "Read the current state of all clues, clue links, and people for this murder. Call this first before making any changes.",
      schema: z.object({}),
    },
  );
