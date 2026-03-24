import { db } from "@/db";
import { clueLinks } from "@/db/models/clueLink";
import { clues } from "@/db/models/clues";
import { people } from "@/db/models/people";
import { tool } from "@langchain/core/tools";
import { eq } from "drizzle-orm";
import { z } from "zod";

const DEFAULT_DESCRIPTION =
  "Create a clue and link it to people already created. All personIds must exist before calling this.";

const DEFAULT_RETRY_MSG =
  "RETRY: personId ${personId} does not exist. Use create_person first, then use the returned personId.";
const FIX_RETRY_MSG =
  "RETRY: personId ${personId} does not exist. Use create_person first.";

export const createCreateClueTool = (
  getMurderId: () => number,
  options?: {
    toolDescription?: string;
    logPrefix?: string;
  },
) => {
  const toolDescription = options?.toolDescription ?? DEFAULT_DESCRIPTION;
  const logPrefix = options?.logPrefix ? `${options.logPrefix} ` : "";
  const retryMsg = options?.toolDescription ? FIX_RETRY_MSG : DEFAULT_RETRY_MSG;

  return tool(
    async ({
      description,
      relatedPeople,
    }: {
      description: string;
      relatedPeople: { personId: number; relation: string }[];
    }) => {
      const mId = getMurderId();

      for (const { personId } of relatedPeople) {
        const person = await db.query.people.findFirst({
          where: eq(people.id, personId),
        });
        if (!person) {
          return retryMsg.replace("${personId}", String(personId));
        }
      }

      const [clue] = await db
        .insert(clues)
        .values({ description, murderId: mId })
        .returning();

      const insertedLinks: { clueLinkId: number; personId: number }[] = [];
      for (const { personId, relation } of relatedPeople) {
        const [link] = await db
          .insert(clueLinks)
          .values({
            murderId: mId,
            clueId: clue.id,
            personId,
            description: relation,
          })
          .returning();
        insertedLinks.push({ clueLinkId: link.id, personId });
      }

      console.log(
        `🔍 ${logPrefix}Clue created:`,
        description.slice(0, 60) + "...",
      );
      return JSON.stringify({ clueId: clue.id, clueLinks: insertedLinks });
    },
    {
      name: "create_clue",
      description: toolDescription,
      schema: z.object({
        description: z
          .string()
          .describe("Objective, factual description of the clue"),
        relatedPeople: z
          .array(
            z.object({
              personId: z
                .number()
                .describe("personId of a person connected to this clue"),
              relation: z
                .string()
                .describe(
                  "A 1-sentence description of how this person is connected to the clue",
                ),
            }),
          )
          .describe("People linked to this clue"),
      }),
    },
  );
};
