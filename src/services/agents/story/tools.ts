import { db } from "@/db";
import { clueLinks } from "@/db/models/clueLink";
import { clues } from "@/db/models/clues";
import { locations } from "@/db/models/location";
import { murders } from "@/db/models/murders";
import { people } from "@/db/models/people";
import { tool } from "@langchain/core/tools";
import { count, eq } from "drizzle-orm";
import { readFileSync } from "fs";
import { join } from "path";
import { z } from "zod";

export const SYSTEM_PROMPT = readFileSync(
  join(__dirname, "prompts", "system.md"),
  "utf-8",
);

export const buildTools = () => {
  let murderId: number | null = null;

  const getMurderId = () => {
    if (!murderId) throw new Error("Murder scene not created yet");
    return murderId;
  };

  const createMurderScene = tool(
    async ({ description }: { description: string }) => {
      const [murder] = await db
        .insert(murders)
        .values({ description })
        .returning();
      murderId = murder.id;
      console.log("🔪 Murder scene created:", description);
      return JSON.stringify({ murderId: murder.id });
    },
    {
      name: "create_murder_scene",
      description:
        "Create the murder scene with a crime description. Call this first.",
      schema: z.object({
        description: z
          .string()
          .describe(
            "A 1-sentence description of the crime scene including cause of death. No names. No sci-fi.",
          ),
      }),
    },
  );

  const createPerson = tool(
    async ({
      name,
      age,
      gender,
      occupation,
      description,
      personality,
      motive,
      address,
      locationDescription,
    }: {
      name: string;
      age: number;
      gender: "male" | "female";
      occupation: string;
      description: string;
      personality: string;
      motive?: string;
      address: string;
      locationDescription: string;
    }) => {
      const mId = getMurderId();

      // Ensure name uniqueness
      const existing = await db
        .select({ count: count() })
        .from(people)
        .where(eq(people.name, name));
      if (existing[0].count > 0) {
        return `RETRY: A person named "${name}" already exists. Choose a different name.`;
      }

      const [location] = await db
        .insert(locations)
        .values({ address, description: locationDescription, murderId: mId })
        .returning();

      const [person] = await db
        .insert(people)
        .values({
          name,
          age,
          gender,
          occupation,
          description,
          personality,
          motive: motive ?? null,
          locationId: location.id,
          murderId: mId,
        })
        .returning();

      console.log("👤 Person created:", name, `(${occupation})`);
      return JSON.stringify({ personId: person.id, locationId: location.id });
    },
    {
      name: "create_person",
      description:
        "Create a person in the murder investigation. Returns personId.",
      schema: z.object({
        name: z.string().describe("Full name of the person"),
        age: z.number().describe("Age of the person"),
        gender: z.enum(["male", "female"]).describe("Gender of the person"),
        occupation: z.string().describe("Occupation of the person"),
        description: z
          .string()
          .describe("A 1-sentence physical description of the person"),
        personality: z
          .string()
          .describe("Comma-separated single-word personality traits"),
        motive: z
          .string()
          .optional()
          .describe(
            "The perpetrator's specific motive for the murder. Only set this for the perpetrator — leave empty for all other people.",
          ),
        address: z
          .string()
          .describe("The address where this person lives or works"),
        locationDescription: z
          .string()
          .describe(
            "A 1-sentence description of the physical space where this person is located. Do NOT mention the person.",
          ),
      }),
    },
  );

  const setVictimAndPerpetrator = tool(
    async ({
      victimId,
      perpetratorId,
      locationId,
    }: {
      victimId: number;
      perpetratorId: number;
      locationId: number;
    }) => {
      const mId = getMurderId();
      await db
        .update(murders)
        .set({ victimId, perpetratorId, locationId })
        .where(eq(murders.id, mId));
      console.log("🫆 Victim and perpetrator set");
      return "success";
    },
    {
      name: "set_victim_and_perpetrator",
      description:
        "Link the victim and perpetrator to the murder, and set the murder location. Call after creating both people.",
      schema: z.object({
        victimId: z.number().describe("personId of the victim"),
        perpetratorId: z.number().describe("personId of the perpetrator"),
        locationId: z
          .number()
          .describe("locationId of the victim (the crime scene location)"),
      }),
    },
  );

  const createClue = tool(
    async ({
      description,
      relatedPeople,
    }: {
      description: string;
      relatedPeople: { personId: number; relation: string }[];
    }) => {
      const mId = getMurderId();

      // Validate all personIds exist
      for (const { personId } of relatedPeople) {
        const person = await db.query.people.findFirst({
          where: eq(people.id, personId),
        });
        if (!person) {
          return `RETRY: personId ${personId} does not exist. Use create_person first, then use the returned personId.`;
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

      console.log("🔍 Clue created:", description.slice(0, 60) + "...");
      return JSON.stringify({ clueId: clue.id, clueLinks: insertedLinks });
    },
    {
      name: "create_clue",
      description:
        "Create a clue and link it to people already created. All personIds must exist before calling this.",
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

  const markClueVisible = tool(
    async ({ clueLinkId }: { clueLinkId: number }) => {
      await db
        .update(clueLinks)
        .set({ isVisible: 1 })
        .where(eq(clueLinks.id, clueLinkId));
      return "success";
    },
    {
      name: "mark_clue_visible",
      description:
        "Mark a clue link as visible at the initial crime scene. Use for physical evidence found at the scene.",
      schema: z.object({
        clueLinkId: z
          .number()
          .describe(
            "The clueLinkId returned by create_clue to mark as visible",
          ),
      }),
    },
  );

  return {
    tools: [
      createMurderScene,
      createPerson,
      setVictimAndPerpetrator,
      createClue,
      markClueVisible,
    ],
    getMurderId,
  };
};
