import { db } from "@/db";
import { clues } from "@/db/models/clues";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { generatePersonFromDescription } from "../person/person";
import { clueLinks } from "@/db/models/clueLink";
import { verifyClueAgainstContraint } from "./analyser";

export const getTools = (murderId: number) => {
  const createClue = tool(
    async (args: {
      originalPrompt: string;
      clue: {
        description: string;
        relatedPeople: {
          relation: string;
          personId: number;
        }[];
      };
      disproveClue: {
        description: string;
        relatedPeople: {
          relation: string;
          personId: number;
        }[];
      };
    }): Promise<string> => {
      console.log("🔍 Evaluating clue:", args);
      console.log("");

      const result = await verifyClueAgainstContraint(args);
      if (!result.valid) {
        console.log("👮‍♂️ Clue not valid to constraints:");
        console.log("   clue:", args.clue.description);
        console.log("   reason:", result.reason);
        console.log("");

        return JSON.stringify({
          retry: result.reason,
        });
      }

      console.log("❓ Clue:", args.clue.description);
      console.log("");

      if (args.disproveClue.description !== "") {
        console.log("❓ Disprove clue:", args.disproveClue.description);
        console.log("");
      }

      const [clue] = await db
        .insert(clues)
        .values({
          murderId,
          description: args.clue.description,
        })
        .returning();

      for (const person of args.clue.relatedPeople) {
        await db.insert(clueLinks).values({
          description: person.relation,
          clueId: clue.id,
          personId: person.personId,
          murderId,
        });
      }

      if (args.disproveClue.description !== "") {
        const [disproveClue] = await db
          .insert(clues)
          .values({
            murderId,
            description: args.disproveClue.description,
          })
          .returning();

        for (const person of args.disproveClue.relatedPeople) {
          await db.insert(clueLinks).values({
            description: person.relation,
            clueId: disproveClue.id,
            personId: person.personId,
            murderId,
          });
        }
      }
      return JSON.stringify({
        clueId: clue.id,
      });
    },
    {
      name: "create_clue",
      description:
        "Create a new clue from a description, keep creating clues until this tool returns 'stop'",
      schema: z.object({
        originalPrompt: z
          .string()
          .describe(
            "The full unaltered original prompt that generated the clue",
          ),

        clue: z
          .object({
            description: z.string().describe("Description of the clue"),
            relatedPeople: z.array(
              z.object({
                relation: z
                  .string()
                  .describe("Relation of the person to the clue"),
                personId: z.number().describe("Id of the person"),
              }),
            ),
          })
          .describe("The clue to be created"),

        disproveClue: z
          .object({
            description: z.string().describe("Description of the clue"),
            relatedPeople: z.array(
              z.object({
                relation: z
                  .string()
                  .describe("Relation of the person to the clue"),
                personId: z.number().describe("Id of the person"),
              }),
            ),
          })
          .describe("An optional clue to disprove the other clue"),
      }),
    },
  );

  const createPerson = tool(
    async (args: { description: string }): Promise<string> => {
      const person = await generatePersonFromDescription(
        murderId,
        args.description,
      );
      console.log("👤 Person:");
      console.log("   name:", person.name);
      console.log("   gender:", person.gender);
      console.log("   occupation:", person.occupation);
      console.log("   personality:", person.personality);
      console.log("");
      return person.id.toString();
    },
    {
      name: "create_person",
      description:
        "Create a new person to be related to a clue, the ID of the person is returned in the response",
      schema: z.object({
        description: z.string().describe("Description of the person"),
      }),
    },
  );

  const linkPersonToClue = tool(
    async (args: {
      personId: number;
      clueId: number;
      relation: string;
    }): Promise<string> => {
      await db.insert(clueLinks).values({
        description: args.relation,
        clueId: Number(args.clueId),
        personId: Number(args.personId),
        murderId: murderId,
      });
      return "success";
    },
    {
      name: "link_person_to_clue",
      description: "Link an existing person to a clue",
      schema: z.object({
        personId: z
          .number()
          .describe("The id returned from create_person, or in existing clues"),
        clueId: z
          .number()
          .describe("The id returned from create_clue, or in existing clues"),
        relation: z.string().describe("Relation of the person to the clue"),
      }),
    },
  );

  return {
    createClue,
    createPerson,
    linkPersonToClue,
  };
};
