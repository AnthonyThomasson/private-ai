import { db } from "@/db";
import { clueLinks } from "@/db/models/clueLink";
import { clues } from "@/db/models/clues";
import { locations } from "@/db/models/location";
import { murders } from "@/db/models/murders";
import { people } from "@/db/models/people";
import { tool } from "@langchain/core/tools";
import { eq, count } from "drizzle-orm";
import { z } from "zod";
import { createDeepAgent } from "deepagents";
import { generateImageForMurder } from "../../painter/murder";
import { generateImageForPerson } from "../../painter/person";

const SYSTEM_PROMPT = `You are generating a murder mystery scenario. Use write_todos to plan your work, then execute each step.

## Setup
1. Invent a realistic murder: a specific type (poisoning, stabbing, etc.) and location on Earth
2. Call create_murder_scene with a 1-sentence crime scene description (cause of death, no sci-fi, no names)
3. Call create_person for the VICTIM — a person found at the crime scene
4. Call create_person for the PERPETRATOR (the actual killer — keep secret, clues should only allude to them)
5. Call set_victim_and_perpetrator

## How Clue Discovery Works
Clues are ONLY discovered through suspect interviews — the player cannot find them any other way.

Each clue has one or more people linked to it via a "relation". This relation is the information that
person will reveal when the player interviews them. The game works like this:

1. The player inspects the crime scene and sees visible clues (physical evidence)
2. Each visible clue names or implies a person to interview
3. The player interviews that person; the person's "relation" to the clue is what they reveal
4. That revelation points to the next clue or person in the chain
5. This continues until the player has enough evidence to identify the perpetrator

For this to work, EVERY clue must:
- Be linked to at least one real person who can be interviewed about it
- Have a "relation" that sounds like natural knowledge a person would share in conversation
  (e.g. "saw someone leaving the building that night", "owns the item found at the scene",
  "overheard a heated argument between the victim and someone matching the perpetrator's description")
- Have a description that looks genuinely suspicious from the outside — never self-labeling
  as unimportant, unrelated, or a dead end

Dead ends are discovered THROUGH conversation, not FROM the clue itself:
- A dead-end clue looks exactly as suspicious as a real clue
- The person linked to it has a plausible "relation" — they know something believable, but it just
  doesn't connect further to the crime when followed up
- Only after the player talks to them does the trail go cold

## Generating Clues
Create between 4 and 7 clues total. Design the full set so that:

- **Some clues form a genuine trail** toward the perpetrator — each linked person's "relation"
  naturally points the player toward the next clue or suspect. The evidence only becomes damning
  when several clues are connected together. The perpetrator must never be directly named.

- **Include 1–2 red herring suspects** — people who appear deeply suspicious (motive, opportunity,
  conflicting alibis) but are ultimately innocent. Their linked clues should look exactly as damning
  as real evidence. The player only discovers the truth through exhaustive questioning.

- **Include at least one plausible-looking dead end** — a clue that appears significant but whose
  linked person, when interviewed, reveals information that doesn't connect to the actual crime.
  The clue description must not hint at this; it should look like a real lead.

- **Mark crime scene clues as visible** — physical evidence present at the initial crime scene
  should be marked visible with mark_clue_visible. All other clues start hidden and are only
  unlocked through interviews.

For each clue: first create any new people it references with create_person, then call create_clue.

## Rules
- clue.description = the observable fact the player sees. Always looks suspicious. Never reveals
  whether it leads anywhere.
- clueLink.relation = what that person knows and will reveal in conversation. Must sound natural,
  specific, and like something a real person would say — not a formal clue summary.
- Clues are objective facts only — never interrogation results, never opinions
- All person names must be unique
- The real perpetrator must never be directly named in any clue or relation
- Keep the full cast of people narratively coherent with each other and the crime scene
`;

const buildTools = () => {
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
      address,
      locationDescription,
    }: {
      name: string;
      age: number;
      gender: "male" | "female";
      occupation: string;
      description: string;
      personality: string;
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

export const generateMurder = async () => {
  const { tools, getMurderId } = buildTools();

  const agent = createDeepAgent({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tools: tools as any,
    model: "openai:gpt-4.1-mini",
    systemPrompt: SYSTEM_PROMPT,
  });

  console.log("🌱 Deep agent generating murder mystery...");
  await agent.invoke({
    messages: [{ role: "user", content: "Generate a murder mystery." }],
  });

  const murderId = getMurderId();

  console.log("🖼️  Painting artwork");
  await generateImageForMurder(murderId);

  const peopleInMurder = await db.query.people.findMany({
    where: eq(people.murderId, murderId),
  });
  await Promise.all(peopleInMurder.map((p) => generateImageForPerson(p.id)));

  return db.query.murders.findFirst({
    where: eq(murders.id, murderId),
    with: {
      location: true,
      victim: true,
      perpetrator: true,
      people: true,
      clueLinks: {
        with: {
          clue: true,
          person: true,
        },
      },
    },
  });
};
