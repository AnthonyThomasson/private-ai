import { db } from "@/db";
import { people } from "@/db/models/people";
import { tool } from "@langchain/core/tools";
import { eq } from "drizzle-orm";
import { z } from "zod";

export const createUpdatePersonMotiveTool = () =>
  tool(
    async ({ personId, motive }: { personId: number; motive: string }) => {
      const person = await db.query.people.findFirst({
        where: eq(people.id, personId),
      });
      if (!person) {
        return `RETRY: personId ${personId} does not exist.`;
      }
      await db.update(people).set({ motive }).where(eq(people.id, personId));
      console.log(`✏️  Person ${personId} motive updated`);
      return "success";
    },
    {
      name: "update_person_motive",
      description:
        "Rewrite the perpetrator's motive. Only use on the perpetrator — never set a motive on victims or witnesses.",
      schema: z.object({
        personId: z.number().describe("The personId of the perpetrator"),
        motive: z
          .string()
          .describe(
            "The new, specific motive — must name the relationship, secret, or concrete reason. Must not be generic.",
          ),
      }),
    },
  );
