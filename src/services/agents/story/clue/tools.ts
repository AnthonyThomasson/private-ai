import { db } from "@/db";
import { clueLinks } from "@/db/models/clueLink";
import { clues } from "@/db/models/clues";
import { murders } from "@/db/models/murders";
import { tool } from "@langchain/core/tools";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { generatePersonFromDescription } from "../person/person";
import { verifyOutputAgainstConstraints } from "./analyser";

export const getTools = (murderId: number) => {
  const createClue = tool(
    async (args: {
      originalClueDescription: string;
      clue: {
        description: string;
        relatedPeople: {
          relation: string;
          personId: number;
          newPersonDescription: string;
        }[];
      };
    }): Promise<string> => {
      console.log("🔍 Adding clue:");
      console.log("  description:", args.clue.description);
      console.log("  relatedPeople:", args.clue.relatedPeople);
      console.log("");

      const murder = await db.query.murders.findFirst({
        where: eq(murders.id, murderId),
        with: {
          people: true,
        },
      });

      if (!murder) {
        throw new Error("Murder not found");
      }

      // verify related people
      let result = await verifyOutputAgainstConstraints(
        murderId,
        JSON.stringify(args.clue.relatedPeople),
        `Verify that newPersonDescription does not match any exiting people in the murder. That field
          is to be used to generate a new person if the person does not exist. If they do exist they should
          be tied to the clue wiht personId.
          
          EXISTING PEOPLE: ${JSON.stringify(murder.people)}
          `,
      );
      if (!result.valid) {
        console.log("❌ Invalid use of relatedPeople:");
        console.log("   reason:", result.reason);
        console.log("");
        return `RETRY: ${result.reason}`;
      }

      // verify unique names
      result = await verifyOutputAgainstConstraints(
        murderId,
        JSON.stringify(args.clue.relatedPeople),
        `Verify that newPersonDescription does not include a name that is already used in the murder.
        
        EXISTING PEOPLE: ${JSON.stringify(murder.people)}
        `,
      );
      if (!result.valid) {
        console.log("❌ Existing person name:");
        console.log("   reason:", result.reason);
        console.log("");
        return `RETRY: ${result.reason}`;
      }

      const [clue] = await db
        .insert(clues)
        .values({
          description: args.clue.description,
          murderId,
        })
        .returning();

      for (const person of args.clue.relatedPeople) {
        let personId = person.personId;
        if (person.newPersonDescription) {
          const newPerson = await generatePersonFromDescription(
            murder.id,
            person.newPersonDescription,
          );
          personId = newPerson.id;
        }

        await db.insert(clueLinks).values({
          murderId,
          clueId: clue.id,
          personId,
          description: person.relation,
        });
      }

      return "success";
    },
    {
      name: "create_clue",
      description:
        "Create a new clue from a description, if the clue is not valid, apply the directions provided in the retry response",
      schema: z.object({
        originalClueDescription: z
          .string()
          .describe(
            "The original clue description that the clue is generated from",
          ),
        clue: z
          .object({
            description: z.string().describe("Description of the clue"),
            relatedPeople: z.array(
              z.object({
                relation: z
                  .string()
                  .describe(
                    "A one sentence description of the relation that the person has to the clue",
                  ),
                personId: z
                  .number()
                  .describe(
                    "Id of the person if the person already exists, set this to 0 if the person does not exist",
                  ),
                newPersonDescription: z
                  .string()
                  .describe(
                    "Description of the person if the person does not exist",
                  ),
              }),
            ),
          })
          .describe("The clue to be created"),
      }),
    },
  );

  return {
    createClue,
  };
};
