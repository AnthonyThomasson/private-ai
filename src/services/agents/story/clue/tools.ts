import { db } from "@/db";
import { clues } from "@/db/models/clues";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { generatePersonFromDescription } from "../person/person";
import { clueLinks } from "@/db/models/clueLink";
import { count, eq } from "drizzle-orm";
import {
  hasEnoughCluesToSolveMurder,
  isClueFollowingTheModifier,
  isClueFoundAtCrimeScene,
  verifyClueAgainstContraint,
} from "./analyser";
import { murders } from "@/db/models/murders";

export const getTools = (murderId: number) => {
  const maxCluesFoundAtCrimeScene = 3;
  let numCluesFoundAtCrimeScene = 0;

  const createClue = tool(
    async (args: {
      description: string;
      relatedPeople: {
        relation: string;
        personId: number;
      }[];
    }): Promise<string> => {
      let modifier = "Create a clue related to the physical crime scene";
      if (numCluesFoundAtCrimeScene >= maxCluesFoundAtCrimeScene) {
        modifier =
          "Create a clue unrelated to the physical crime scene, and that could be found by interviewing a previously created suspect. Use the link_person_to_clue tool to link existing suspects to the new clue.";
      }

      const result = await verifyClueAgainstContraint(args);
      if (!result.valid) {
        console.log("👮‍♂️ Clue not valid to constraints:");
        console.log("   clue:", args.description);
        console.log("   reason:", result.reason);

        return JSON.stringify({
          continue: true,
          retry: result.reason,
        });
      }

      const { following, reason } = await isClueFollowingTheModifier(
        modifier,
        args,
      );
      if (!following) {
        console.log("👮‍♂️ Clue did not follow the instructions of the modifier:");
        console.log("   clue:", args.description);
        console.log("   modifier:", modifier);
        console.log("   reason:", reason);
        return JSON.stringify({
          continue: false,
          retry:
            "The clue is not following the instructions of the modifier. " +
            reason,
          modifier,
        });
      }
      const { found } = await isClueFoundAtCrimeScene(murderId, args);
      if (found) {
        numCluesFoundAtCrimeScene++;
      }

      console.log("❓ Clue:", args.description);
      console.log("");

      const [clue] = await db
        .insert(clues)
        .values({
          murderId,
          description: args.description,
        })
        .returning();

      for (const person of args.relatedPeople) {
        await db.insert(clueLinks).values({
          description: person.relation,
          clueId: clue.id,
          personId: person.personId,
          isVisible: found ? 1 : 0,
          murderId,
        });
      }

      const numClues = (
        await db
          .select({ count: count() })
          .from(clues)
          .where(eq(clues.murderId, murderId))
      )[0].count;

      const enoughClues = await hasEnoughCluesToSolveMurder(murderId);

      if (numClues >= 10 || enoughClues.enoughClues) {
        await db
          .update(murders)
          .set({
            perpetratorId: enoughClues.murdererId,
          })
          .where(eq(murders.id, murderId));
        return JSON.stringify({
          continue: false,
        });
      }

      return JSON.stringify({
        clueId: clue.id,
        continue: true,
        modifier,
      });
    },
    {
      name: "create_clue",
      description:
        "Create a new clue from a description, keep creating clues until this tool returns 'stop'",
      schema: z.object({
        description: z.string().describe("Description of the clue"),
        relatedPeople: z.array(
          z.object({
            relation: z.string().describe("Relation of the person to the clue"),
            personId: z.number().describe("Id of the person"),
          }),
        ),
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
