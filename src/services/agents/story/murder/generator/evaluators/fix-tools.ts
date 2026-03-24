import { db } from "@/db";
import { clueLinks } from "@/db/models/clueLink";
import { clues } from "@/db/models/clues";
import { locations } from "@/db/models/location";
import { murders } from "@/db/models/murders";
import { people } from "@/db/models/people";
import { tool } from "@langchain/core/tools";
import { count, eq } from "drizzle-orm";
import { z } from "zod";

export const buildFixTools = (murderId: number) => {
  const getChainState = tool(
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

  const setClueLinkVisible = tool(
    async ({
      clueLinkId,
      visible,
    }: {
      clueLinkId: number;
      visible: boolean;
    }) => {
      await db
        .update(clueLinks)
        .set({ isVisible: visible ? 1 : 0 })
        .where(eq(clueLinks.id, clueLinkId));
      console.log(`👁️  Clue link ${clueLinkId} visibility set to ${visible}`);
      return "success";
    },
    {
      name: "set_clue_link_visible",
      description:
        "Mark a clue link as visible (true) or hidden (false). Use to fix incorrect visibility — only the 1–2 initial crime-scene clue links should be visible.",
      schema: z.object({
        clueLinkId: z.number().describe("The clueLinkId to update"),
        visible: z
          .union([z.boolean(), z.number()])
          .transform((v) => Boolean(v))
          .describe("true/1 = visible at crime scene, false/0 = hidden"),
      }),
    },
  );

  const updateClueDescription = tool(
    async ({
      clueId,
      description,
    }: {
      clueId: number;
      description: string;
    }) => {
      await db.update(clues).set({ description }).where(eq(clues.id, clueId));
      console.log(`✏️  Clue ${clueId} description updated`);
      return "success";
    },
    {
      name: "update_clue_description",
      description:
        "Rewrite a clue's description text. Use to remove the perpetrator's name if it was accidentally included.",
      schema: z.object({
        clueId: z.number().describe("The clueId to update"),
        description: z
          .string()
          .describe(
            "The corrected clue description — must not contain the perpetrator's name",
          ),
      }),
    },
  );

  const updateClueRelation = tool(
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

  const updateClueLinkPerson = tool(
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

  const addClueLink = tool(
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
      const existing = await db
        .select({ count: count() })
        .from(people)
        .where(eq(people.name, name));
      if (existing[0].count > 0) {
        return `RETRY: A person named "${name}" already exists. Choose a different name.`;
      }
      const [location] = await db
        .insert(locations)
        .values({ address, description: locationDescription, murderId })
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
          murderId,
        })
        .returning();
      console.log("👤 Fix: Person created:", name, `(${occupation})`);
      return JSON.stringify({ personId: person.id, locationId: location.id });
    },
    {
      name: "create_person",
      description:
        "Create a new person. Only use when the fix genuinely requires a new intermediate suspect or red herring (e.g. to extend chain depth or add a dead-end branch). Returns personId.",
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
            "A 1-sentence description of the physical space. Do NOT mention the person.",
          ),
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
      for (const { personId } of relatedPeople) {
        const person = await db.query.people.findFirst({
          where: eq(people.id, personId),
        });
        if (!person) {
          return `RETRY: personId ${personId} does not exist. Use create_person first.`;
        }
      }
      const [clue] = await db
        .insert(clues)
        .values({ description, murderId })
        .returning();
      const insertedLinks: { clueLinkId: number; personId: number }[] = [];
      for (const { personId, relation } of relatedPeople) {
        const [link] = await db
          .insert(clueLinks)
          .values({
            murderId,
            clueId: clue.id,
            personId,
            description: relation,
          })
          .returning();
        insertedLinks.push({ clueLinkId: link.id, personId });
      }
      console.log("🔍 Fix: Clue created:", description.slice(0, 60) + "...");
      return JSON.stringify({ clueId: clue.id, clueLinks: insertedLinks });
    },
    {
      name: "create_clue",
      description:
        "Create a new clue with links to people. Only use when the fix requires adding a bridge clue or dead-end clue that doesn't exist yet.",
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

  const updatePersonMotive = tool(
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

  return [
    getChainState,
    setClueLinkVisible,
    updateClueDescription,
    updateClueRelation,
    updateClueLinkPerson,
    addClueLink,
    createPerson,
    createClue,
    updatePersonMotive,
  ];
};
