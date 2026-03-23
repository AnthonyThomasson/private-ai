import { db } from "@/db";
import { clueLinks } from "@/db/models/clueLink";
import { clues } from "@/db/models/clues";
import { locations } from "@/db/models/location";
import { murders } from "@/db/models/murders";
import { people } from "@/db/models/people";
import { tool } from "@langchain/core/tools";
import { ChatOpenAI } from "@langchain/openai";
import { createDeepAgent } from "deepagents";
import { count, eq } from "drizzle-orm";
import { readFileSync } from "fs";
import { join } from "path";
import { z } from "zod";
import { generateImageForMurder } from "../../painter/murder";
import { generateImageForPerson } from "../../painter/person";
import { getMurderSeed } from "./seed";

const SYSTEM_PROMPT = `You are generating a murder mystery scenario.

## Step 0: Plan Your Chain FIRST (mandatory)
Before calling any tools, use write_todos to lay out:
  a) Murder setting and method
  b) Victim name (DEAD — never create any clue link for the victim)
  c) Perpetrator name (kept secret in ALL clues and relations — never write this name in any clue text)
  d) The FULL investigation chain: InitialSuspect → SuspectB → SuspectC → Perpetrator
     (This means ≥ 2 intermediate suspects between crime scene and perpetrator)
  e) At least 1 dead-end branch: an initial suspect who leads to a red herring, not the perpetrator
  f) For each bridge clue: who reveals it AND who it unlocks (two people per bridge clue)
  g) Which 1–2 crime-scene clues link to initial suspects (visible from start)
  h) The perpetrator's motive — a specific, believable reason grounded in the setting and relationships
     (e.g. inheritance dispute, jealousy, blackmail, silencing a witness, revenge). Must be consistent
     with the clue chain you design.

CHAIN RULES — non-negotiable:
- Chain depth MUST be ≥ 2 intermediate suspects before the perpetrator is reachable
  Example of VALID chain: Crime scene → PersonA → PersonB → Perpetrator (depth 2 ✅)
  Example of INVALID chain: Crime scene → PersonA → Perpetrator (depth 1 ❌ — too short, retry)
- At least one initial suspect MUST lead to a dead-end (red herring) that never reaches the perpetrator
- Every non-initial suspect must be unlocked by a bridge clue from the preceding suspect
- The victim MUST NOT appear in any clue link — they are dead and cannot be interviewed
- Every clue in the chain must be consistent with the perpetrator's motive. The motive must NOT
  appear in any clue text, but the clues should logically support why someone with that motive
  would commit this crime.

## Setup
1. Invent a realistic murder: a specific type (poisoning, stabbing, etc.) and location on Earth
2. Call create_murder_scene with a 1-sentence crime scene description (cause of death, no sci-fi, no names)
3. Call create_person for the VICTIM — a person found dead at the crime scene (DEAD — cannot be interviewed, do not create clue links for them)
4. Call create_person for the PERPETRATOR — pass their motive in the \`motive\` field. The motive must
   be specific (not generic) and plausible given the victim, the location, and the relationships you've
   established. (Keep the perpetrator's identity secret — clues should only allude to them)
5. Call set_victim_and_perpetrator

## How the Gameplay Loop Works (CRITICAL)
The player discovers suspects ONLY through interviews. Suspects unlock each other in a chain:

1. The player sees the crime scene with a few VISIBLE clues
2. Each visible clue is linked to an initial suspect — that suspect appears in the sidebar
3. The player interviews that suspect; during conversation the suspect reveals a hidden clue
4. Revealing a hidden clue also makes the NEXT suspect in that clue's link appear in the sidebar
5. The player interviews the next suspect, and so on, until reaching evidence that points to the perpetrator

**For this chain to work, each "bridge" clue MUST be linked to TWO people:**
- The INFORMANT: the person who will reveal this clue during their interview (they know something)
- The NEXT SUSPECT: the person who becomes discoverable once this clue is revealed

When the informant reveals the clue, both their link AND the next suspect's link become visible.
This is how new suspects unlock. If a clue only links to one person, no new suspect unlocks from it.

## Clue Structure

### Crime-scene clues (VISIBLE from the start)
- Physical evidence at the scene that immediately points to 1–2 initial suspects
- Link each to ONE living suspect (NOT the victim — the victim is dead, excluded from sidebar)
  ❌ WRONG: linked to the victim — useless, victim cannot be interviewed
  ✅ RIGHT: linked to a living suspect who was at or near the scene
- Mark each visible with mark_clue_visible — ONLY call mark_clue_visible on these 1–2 initial crime-scene clue links
- The linked person's relation = what they know and will share when interviewed
- Mention the victim in the clue DESCRIPTION if needed, but never in a clue link

⚠️  mark_clue_visible MUST only be called for initial crime-scene clues (1–2 total).
    NEVER call mark_clue_visible on bridge clues, the perpetrator clue, or dead-end clues.
    Calling mark_clue_visible on the wrong links will immediately expose the perpetrator and break the game.

### Bridge clues (HIDDEN — unlocked through interviews)
- Each bridge clue MUST link to BOTH: (a) the informant, AND (b) the next suspect
- Informant's relation = what they know about this clue (they reveal it in conversation)
- Next suspect's relation = why they're connected to this clue (makes them discoverable)
- The informant is the person who currently has visible clue links (already in sidebar)
- Do NOT mark these visible — they start hidden and unlock when the informant reveals them

### Perpetrator-linking clue (HIDDEN — the final step)
- The last clue in the chain links to the perpetrator
- The preceding suspect reveals it; the perpetrator becomes discoverable
- The perpetrator's relation = the damning connection that breaks the case

### Dead-end clues (HIDDEN — REQUIRED, at least one)
- A bridge clue from an initial suspect that leads to a red herring suspect, NOT toward the perpetrator
- The red herring's relation sounds suspicious but, when followed up in conversation, goes nowhere
- Must still link to two people (informant + red herring) so the red herring unlocks properly
- This ensures the player cannot trivially follow a single linear path to the perpetrator

## Example Chain (follow this structure)
1. C1 (visible): "A monogrammed handkerchief near the body" → linked to Person A
   - Person A.relation: "Saw someone arguing with the victim at 11pm near the study"
   - mark_clue_visible on C1's link to Person A

2. C2 (hidden): "CCTV footage of a figure in a distinctive coat" → linked to Person A AND Person B
   - Person A.relation: "That coat — I know exactly who owns one like that"
   - Person B.relation: "Was seen on CCTV near the victim's building that night"
   Person A reveals C2 in interview → C2's link to Person B becomes visible → Person B unlocks in sidebar

3. C3 (hidden): "A threatening letter in the victim's apartment" → linked to Person B AND Perpetrator
   - Person B.relation: "Recognized the handwriting from a note they'd seen before"
   - Perpetrator.relation: "Wrote the letter under a false name three weeks before the murder"
   Person B reveals C3 → Perpetrator becomes discoverable

## Final Check (BEFORE finishing)
Verify every rule is met before stopping:
- [ ] No clue links on the victim
- [ ] Every non-initial suspect has a bridge clue that links them to their predecessor
- [ ] The perpetrator's clue is linked to the second-to-last suspect
- [ ] ONLY 1–2 crime-scene clue links were marked visible with mark_clue_visible
- [ ] The perpetrator's clue links are NOT marked visible
- [ ] Bridge clues are NOT marked visible
- [ ] Chain depth from crime scene to perpetrator is ≥ 2 intermediate suspects (not 1!)
- [ ] At least one initial suspect leads to a dead-end, not toward the perpetrator
- [ ] The perpetrator's NAME does not appear anywhere in any clue description or relation text

## Rules
- clue.description = the observable fact the player sees. Always looks suspicious. Never reveals
  whether it leads anywhere. Never labels itself as important or unimportant.
- clueLink.relation = what that specific person knows and will reveal in conversation. Natural,
  specific, like something a real person would say — not a formal clue summary.
- For each clue: create any new people it references with create_person first, then call create_clue.
- Clues are objective facts only — never interrogation results, never opinions.
- All person names must be unique.
- ❌ CRITICAL: The perpetrator's name MUST NEVER appear in any clue description or any relation text.
  This applies to ALL clues, including bridge clues and the final perpetrator-linking clue.
  WRONG: "Security footage shows [Perpetrator] acting aggressively near the victim"
  RIGHT: "Security footage shows an unidentified figure behaving aggressively near the victim"
  WRONG: "Testimony about [Perpetrator]'s suspicious behavior near the scene"
  RIGHT: "Testimony about a suspicious individual seen lingering near the victim's area"
  The perpetrator's personId is used to link them to the final clue — their NAME must stay out of all text.
- Keep the full cast of people narratively coherent with each other and the crime scene.
- Create 5–7 clues total (1–2 visible crime-scene clues, 2–3 hidden bridge clues, 1 dead-end clue, 1 perpetrator clue).
`;

const NARRATIVE_FIX_SYSTEM_PROMPT = `You are repairing a murder mystery that failed narrative coherence review.

You will be given the specific narrative problem. Your ONLY job is to make the minimal change that fixes it.

## Step 1: Always call get_chain_state first
Read the current state of all people, clues, and clue links before making any changes.

## Step 2: Identify the exact problem
Map the narrative error to what needs to change in the data.

## Step 3: Fix it minimally — in order of preference
1. Use update_person_motive to strengthen or rewrite the perpetrator's motive if it is too vague or not connected to the victim/crime scene
2. Use update_clue_description to fix a clue that contradicts the cause of death or contains anachronistic/impossible details
3. Use update_clue_relation to fix a relation text that is implausible for the character's role, contradicts another relation, or reveals the perpetrator's identity via unique role paraphrase
4. Only create new people or clues if the narrative fix genuinely requires a new character or evidence element

## Rules (non-negotiable)
- Never write the perpetrator's name in any clue description or relation text
- Never change names, graph structure, or visibility flags — those are already validated structurally
- Never set a motive on anyone other than the perpetrator
- The perpetrator's motive must be specific: name the relationship, the secret, or the concrete reason — not just "greed" or "jealousy"
- Make your change and stop. Do not create new people or clues unless the narrative error explicitly requires them.
- After one update (motive, clue description, or relation), produce a final response. Do not make additional tool calls.
`;

const FIX_SYSTEM_PROMPT = `You are repairing a murder mystery chain that failed validation.

You will be given the exact validation error. Your ONLY job is to make the minimal change that fixes it.

## Step 1: Always call get_chain_state first
Read the current clues, clue links, and people before making any changes.

## Step 2: Identify the exact problem
Map the error to what is broken in the data.

## Step 3: Fix it minimally
- Prefer updating existing data over creating new entities
- Only use create_person / create_clue if the fix genuinely requires a new intermediate suspect or red herring (depth extension, dead-end branch)
- Do NOT rewrite the story. Do NOT change names. Do NOT touch unaffected clues.
- Batch your fix: call get_chain_state once, then make your changes, then STOP. Do not rewire or add links beyond what is strictly needed for this one fix.
- For "perpetrator too close" fixes: create 1 intermediate person, 1 clue, and 2–4 clue links to insert them in the path. Do not modify existing links that are unrelated.
- After executing your fix, produce a final response. Do not make additional tool calls.

## Rules (non-negotiable)
- Never write the perpetrator's name in any clue description or relation text
- Never mark a bridge clue, dead-end clue, or perpetrator clue as visible — only mark the 1–2 initial crime-scene clue links
- A valid chain requires: ≥2 intermediate suspects between crime scene and perpetrator, AND at least one initial suspect that does NOT reach the perpetrator
- The victim must not appear in any clue link
- The validation will re-run automatically after your fix.
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

const buildFixTools = (murderId: number) => {
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

const validateChain = async (
  murderId: number,
  perpetratorId: number,
  victimId: number,
): Promise<{
  valid: boolean;
  reason?: string;
  depth?: Map<number, number>;
}> => {
  const allLinks = await db.query.clueLinks.findMany({
    where: eq(clueLinks.murderId, murderId),
  });

  // Build: clueId → set of personIds linked to it
  const clueToPersons = new Map<number, Set<number>>();
  for (const link of allLinks) {
    if (!clueToPersons.has(link.clueId!))
      clueToPersons.set(link.clueId!, new Set());
    clueToPersons.get(link.clueId!)!.add(link.personId!);
  }

  // Initial suspects: visible links on non-victims
  const visiblePersonIds = new Set(
    allLinks
      .filter((l) => l.isVisible === 1 && l.personId !== victimId)
      .map((l) => l.personId!),
  );

  if (visiblePersonIds.size === 0) {
    return {
      valid: false,
      reason: "No initial suspects — all visible clue links are on the victim",
    };
  }

  // Perpetrator must NOT be visible at the start
  if (visiblePersonIds.has(perpetratorId)) {
    return {
      valid: false,
      reason: "Perpetrator is visible at the crime scene — must be hidden",
    };
  }

  // Build: personId → clueIds they're linked to
  const personToClueIds = new Map<number, number[]>();
  for (const link of allLinks) {
    if (!personToClueIds.has(link.personId!))
      personToClueIds.set(link.personId!, []);
    personToClueIds.get(link.personId!)!.push(link.clueId!);
  }

  // BFS through clue graph
  const depth = new Map<number, number>();
  const queue: number[] = [];
  for (const p of visiblePersonIds) {
    depth.set(p, 0);
    queue.push(p);
  }

  while (queue.length > 0) {
    const personId = queue.shift()!;
    const d = depth.get(personId)!;
    for (const clueId of personToClueIds.get(personId) ?? []) {
      for (const nextPerson of clueToPersons.get(clueId) ?? []) {
        if (!depth.has(nextPerson) && nextPerson !== victimId) {
          depth.set(nextPerson, d + 1);
          queue.push(nextPerson);
        }
      }
    }
  }

  if (!depth.has(perpetratorId)) {
    return {
      valid: false,
      reason: "Perpetrator is not reachable from crime-scene clues",
    };
  }
  const perpetratorDepth = depth.get(perpetratorId)!;
  if (perpetratorDepth < 2) {
    return {
      valid: false,
      reason: `Perpetrator only ${perpetratorDepth} step(s) from crime scene — need ≥ 2`,
    };
  }

  // Check that at least one initial suspect leads to a dead end (not toward perpetrator)
  // i.e., at least one initial suspect has no path to the perpetrator through hidden clues alone
  const hasDeadEnd = Array.from(visiblePersonIds).some((p) => {
    // BFS from this single initial suspect; see if perpetrator is reachable
    const reachable = new Set<number>([p]);
    const q = [p];
    while (q.length > 0) {
      const cur = q.shift()!;
      for (const clueId of personToClueIds.get(cur) ?? []) {
        for (const next of clueToPersons.get(clueId) ?? []) {
          if (!reachable.has(next) && next !== victimId) {
            reachable.add(next);
            q.push(next);
          }
        }
      }
    }
    return !reachable.has(perpetratorId);
  });

  if (!hasDeadEnd) {
    return {
      valid: false,
      reason:
        "Every initial suspect leads to the perpetrator — need at least one dead-end branch",
    };
  }

  // Check that the perpetrator's name does not appear in any clue description or relation text
  const perpetratorPerson = await db.query.people.findFirst({
    where: eq(people.id, perpetratorId),
  });
  if (perpetratorPerson) {
    const perpetratorName = perpetratorPerson.name.toLowerCase();
    const allClues = await db.query.clues.findMany({
      where: eq(clues.murderId, murderId),
    });
    for (const clue of allClues) {
      if (clue.description.toLowerCase().includes(perpetratorName)) {
        return {
          valid: false,
          reason: `Perpetrator's name "${perpetratorPerson.name}" appears in clue description: "${clue.description.slice(0, 80)}..."`,
        };
      }
    }
    for (const link of allLinks) {
      if (
        link.personId !== perpetratorId &&
        link.description?.toLowerCase().includes(perpetratorName)
      ) {
        return {
          valid: false,
          reason: `Perpetrator's name "${perpetratorPerson.name}" appears in a clue relation for person ${link.personId}`,
        };
      }
    }
  }

  return { valid: true, depth };
};

const NARRATIVE_CONSTRAINTS = readFileSync(
  join(__dirname, "prompt", "narrative_constraints.md"),
  "utf-8",
);

const verifyNarrative = async (
  murderId: number,
): Promise<{ valid: boolean; reason?: string }> => {
  const murder = await db.query.murders.findFirst({
    where: eq(murders.id, murderId),
  });
  const allPeople = await db.query.people.findMany({
    where: eq(people.murderId, murderId),
  });
  const allClues = await db.query.clues.findMany({
    where: eq(clues.murderId, murderId),
  });
  const allLinks = await db.query.clueLinks.findMany({
    where: eq(clueLinks.murderId, murderId),
  });

  const state = JSON.stringify({
    murder: {
      id: murder?.id,
      description: murder?.description,
      victimId: murder?.victimId,
      perpetratorId: murder?.perpetratorId,
    },
    people: allPeople.map((p) => ({
      personId: p.id,
      name: p.name,
      age: p.age,
      gender: p.gender,
      occupation: p.occupation,
      description: p.description,
      personality: p.personality,
      motive: p.motive,
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

  const model = new ChatOpenAI({ model: "o4-mini" });
  const schema = z.object({
    valid: z
      .boolean()
      .describe(
        "true if the narrative is coherent and meets all criteria, false otherwise",
      ),
    reason: z
      .string()
      .describe(
        "If invalid, the specific first violation found. If valid, return an empty string.",
      ),
  });
  const structuredLlm =
    model.withStructuredOutput<z.infer<typeof schema>>(schema);

  const result = await structuredLlm.invoke(
    `Review this murder mystery for narrative coherence. Return valid=true only if all criteria are met.

MURDER STATE:
${state}

CRITERIA:
${NARRATIVE_CONSTRAINTS}`,
    { recursionLimit: 100 },
  );

  return result;
};

const cleanupMurder = async (murderId: number) => {
  // Nullify FK references on murder first to avoid circular FK violations
  await db
    .update(murders)
    .set({ victimId: null, perpetratorId: null, locationId: null })
    .where(eq(murders.id, murderId));
  await db.delete(clueLinks).where(eq(clueLinks.murderId, murderId));
  await db.delete(clues).where(eq(clues.murderId, murderId));
  // Delete people before locations (people hold the locationId FK)
  await db.delete(people).where(eq(people.murderId, murderId));
  await db.delete(locations).where(eq(locations.murderId, murderId));
  await db.delete(murders).where(eq(murders.id, murderId));
};

export const generateMurder = async (
  maxRetries = 3,
  maxFixAttempts = 2,
  maxFixRecursionLimit = 16,
) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const { tools, getMurderId } = buildTools();

    const agent = createDeepAgent({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tools: tools as any,
      model: "openai:gpt-4.1-mini",
      systemPrompt: SYSTEM_PROMPT,
    });

    const seed = await getMurderSeed();
    console.log(
      `🗿 Inspiration: ${seed.type} | ${seed.location} | ${seed.era} | ${seed.motiveCategory}`,
    );

    console.log(
      `🌱 Deep agent generating murder mystery... (attempt ${attempt}/${maxRetries})`,
    );
    await agent.invoke({
      messages: [
        {
          role: "user",
          content: `Generate a murder mystery. Use this as inspiration: a ${seed.type} in ${seed.location}. Era: ${seed.era}. Motive inspiration (category only): ${seed.motiveCategory}. The actual motive must be specific and grounded in the story.`,
        },
      ],
    });

    const murderId = getMurderId();
    let murder = await db.query.murders.findFirst({
      where: eq(murders.id, murderId),
    });

    let validation = await validateChain(
      murderId,
      murder!.perpetratorId!,
      murder!.victimId!,
    );

    if (!validation.valid) {
      let fixed = false;
      for (let fix = 1; fix <= maxFixAttempts; fix++) {
        console.warn(
          `🔧 Fix attempt ${fix}/${maxFixAttempts}: ${validation.reason}`,
        );
        const fixAgent = createDeepAgent({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          tools: buildFixTools(murderId) as any,
          model: "openai:o4-mini",
          systemPrompt: FIX_SYSTEM_PROMPT,
        });
        try {
          await fixAgent.invoke(
            {
              messages: [
                {
                  role: "user",
                  content: `Validation failed: "${validation.reason}". Fix this and only this problem.`,
                },
              ],
            },
            { recursionLimit: maxFixRecursionLimit },
          );
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (
            msg.includes("recursion") ||
            msg.includes("recursion_limit") ||
            msg.includes("GRAPH_RECURSION")
          ) {
            console.warn(
              `⚠️  Fix attempt ${fix}: hit recursion limit — treating as fix incomplete`,
            );
          } else {
            throw err;
          }
        }
        murder = await db.query.murders.findFirst({
          where: eq(murders.id, murderId),
        });
        validation = await validateChain(
          murderId,
          murder!.perpetratorId!,
          murder!.victimId!,
        );
        if (validation.valid) {
          fixed = true;
          break;
        }
      }

      if (!fixed) {
        console.warn(
          `⚠️  Attempt ${attempt}: still invalid after fixes — ${validation.reason}. Cleaning up...`,
        );
        await cleanupMurder(murderId);
        if (attempt === maxRetries) {
          throw new Error(
            `Failed to generate a valid murder mystery after ${maxRetries} attempts`,
          );
        }
        continue;
      }
    }

    const perpetratorDepth = validation.depth!.get(murder!.perpetratorId!)!;
    console.log(
      `✅ Chain validated — perpetrator is ${perpetratorDepth} step(s) from crime scene`,
    );

    let narrative = await verifyNarrative(murderId);
    if (!narrative.valid) {
      let narrativeFixed = false;
      for (let fix = 1; fix <= maxFixAttempts; fix++) {
        console.warn(
          `🔧 Narrative fix attempt ${fix}/${maxFixAttempts}: ${narrative.reason}`,
        );
        const narrativeFixAgent = createDeepAgent({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          tools: buildFixTools(murderId) as any,
          model: "openai:o4-mini",
          systemPrompt: NARRATIVE_FIX_SYSTEM_PROMPT,
        });
        try {
          await narrativeFixAgent.invoke(
            {
              messages: [
                {
                  role: "user",
                  content: `Narrative review failed: "${narrative.reason}". Fix this and only this problem.`,
                },
              ],
            },
            { recursionLimit: maxFixRecursionLimit },
          );
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (
            msg.includes("recursion") ||
            msg.includes("recursion_limit") ||
            msg.includes("GRAPH_RECURSION")
          ) {
            console.warn(
              `⚠️  Narrative fix attempt ${fix}: hit recursion limit — treating as fix incomplete`,
            );
          } else {
            throw err;
          }
        }
        narrative = await verifyNarrative(murderId);
        if (narrative.valid) {
          narrativeFixed = true;
          break;
        }
      }

      if (!narrativeFixed) {
        console.warn(
          `⚠️  Attempt ${attempt}: narrative still invalid after fixes — ${narrative.reason}. Cleaning up...`,
        );
        await cleanupMurder(murderId);
        if (attempt === maxRetries) {
          throw new Error(
            `Failed to generate a narratively coherent murder mystery after ${maxRetries} attempts`,
          );
        }
        continue;
      }
    }
    console.log(`✅ Narrative verified`);

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
  }
};
