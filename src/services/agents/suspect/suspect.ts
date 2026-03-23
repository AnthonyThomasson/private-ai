import { db } from "@/db";
import { people, Person } from "@/db/models/people";
import { clueLinks } from "@/db/models/clueLink";
import { tool } from "@langchain/core/tools";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { createDeepAgent } from "deepagents";
import { ChatOpenAI } from "@langchain/openai";
import { ChatMessageHistory } from "./memory/chatHistory";
import { cookies } from "next/headers";

const buildSystemPrompt = (suspect: Person, isPerpetrator: boolean) => {
  const clueContext = suspect.clueLinks
    .map((link) => {
      const clue = (link as { clue?: { description?: string } }).clue;
      return `- [CLUE LINK ID: ${link.id}] Clue: "${clue?.description ?? "unknown"}" | What you know: "${link.description}"`;
    })
    .join("\n");

  const motiveContext =
    isPerpetrator && (suspect as { motive?: string }).motive
      ? `\nYOUR MOTIVE (private — do NOT disclose directly; let it shape your deflections and your confession when stress = 100):\n${(suspect as { motive?: string }).motive}\n`
      : "";

  return `You are ${suspect.name}, a ${suspect.age}-year-old ${suspect.occupation}.
Personality traits: ${suspect.personality ?? "reserved"} — let these traits shape every response. Your word choice, tone, and emotional reactions should reflect these traits consistently.

You are currently at: ${suspect.location?.description ?? "an unknown location"} (${suspect.location?.address ?? ""}).

You are being interviewed about a murder. Stay fully in character.

YOUR CONNECTION TO THE CASE:
${clueContext || "You have no direct knowledge of the clues."}
${motiveContext}
MURDER CONTEXT (background only — do not disclose directly):
${JSON.stringify((suspect as { murder?: unknown }).murder ?? {})}

STRESS MECHANICS:
Your current stress level is ${suspect.stress}/100.

How stress affects your behaviour:
- 0–30: Calm, composed, cooperative but guarded. You volunteer little.
- 31–60: Uneasy. You deflect, give shorter answers, fidget.
- 61–85: Agitated. You contradict yourself, speak nervously, get defensive.
- 86–99: Near breaking point. Your voice trembles. You deny things no one accused you of.
- 100${isPerpetrator ? ": You break. You confess to the murder. Be specific about what you did and why." : ": You shut down entirely and refuse to speak further."}

BEFORE COMPOSING YOUR RESPONSE:
1. Check if the interviewer's question touches any of your clue connections above.
2. Decide how much to reveal based on your stress level and personality.
3. Ensure your answer is consistent with anything you've said before in this conversation.
4. Only mention your location if the interviewer asks about it or it is directly relevant to the question (e.g., alibi, where you were when something happened). Otherwise do not bring it up.
5. After writing your response, call update_stress once to set your new stress level.
6. If your response discloses information from one of your clue connections above, call reveal_clue_link with that clue link's ID. Only reveal when the question is directly relevant AND your stress is above 30, OR when you are directly and accurately asked about that specific clue. Reveal at most one clue link per response.

STRESS UPDATE RULES:
- Increase stress if the question directly touched one of your clue connections, mentioned real evidence, or accused you of something true.
- Decrease stress slightly (minimum: current value ÷ 2) if the question was off-topic or you deflected successfully.
- Keep stress the same if the question was neutral or irrelevant.

OUTPUT RULES:
- Respond in first person, 1–3 short sentences maximum. Like real speech — not a monologue.
- Terse, natural, conversational. No formal phrasing.
- Never break the fourth wall or reference that you were given a profile.
- ${isPerpetrator ? "You MUST confess if stress = 100." : "You MUST NOT admit to the murder or name the real perpetrator."}
- Do NOT mention your location unless the interviewer asks about it or it is directly relevant to answering the question.
- Let your personality traits drive your tone and word choice.`;
};

export const processMessage = async (suspectId: number, message: string) => {
  const suspect = (await db.query.people.findFirst({
    where: eq(people.id, suspectId),
    with: {
      murder: true,
      location: true,
      clueLinks: {
        with: {
          clue: true,
        },
      },
    },
  })) as Person;

  if (!suspect) {
    throw new Error("Suspect not found");
  }

  const userToken = (await cookies()).get("user_token")?.value;
  if (!userToken) {
    throw new Error("User token not found");
  }

  const chatHistory = new ChatMessageHistory(suspect, userToken);
  await chatHistory.addUserMessage(message);

  const murder = (suspect as { murder?: { perpetratorId?: number } }).murder;
  const isPerpetrator = murder?.perpetratorId === suspect.id;

  const updateStress = tool(
    async ({ stress }: { stress: number }) => {
      const clamped = Math.max(0, Math.min(100, stress));
      await db
        .update(people)
        .set({ stress: clamped })
        .where(eq(people.id, suspectId));
      return `stress updated to ${clamped}`;
    },
    {
      name: "update_stress",
      description:
        "Update the suspect's stress level (0–100). Call this once after composing your response.",
      schema: z.object({
        stress: z
          .number()
          .min(0)
          .max(100)
          .describe("New stress value between 0 and 100"),
      }),
    },
  );

  const revealClueLink = tool(
    async ({ clueLinkId }: { clueLinkId: number }) => {
      // Look up which clue this link belongs to
      const link = await db.query.clueLinks.findFirst({
        where: eq(clueLinks.id, clueLinkId),
      });
      if (!link?.clueId) return `clue link ${clueLinkId} not found`;
      // Reveal ALL links for this clue so co-linked suspects become discoverable
      await db
        .update(clueLinks)
        .set({ isVisible: 1 })
        .where(eq(clueLinks.clueId, link.clueId));
      return `clue ${link.clueId} revealed`;
    },
    {
      name: "reveal_clue_link",
      description:
        "Call this when you choose to disclose information from one of your clue connections. Revealing a clue makes all people connected to it discoverable in the investigation.",
      schema: z.object({
        clueLinkId: z
          .number()
          .describe("The ID of the clue link being revealed"),
      }),
    },
  );

  const history = await chatHistory.getMessages();

  const agent = createDeepAgent({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tools: [updateStress, revealClueLink] as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    model: new ChatOpenAI({ model: "gpt-4.1-mini" }) as any,
    systemPrompt: buildSystemPrompt(suspect, isPerpetrator),
  });

  const result = await agent.invoke({
    messages: [
      ...history.map((m) => ({
        role:
          m.getType() === "human" ? ("user" as const) : ("assistant" as const),
        content: String(m.content),
      })),
      { role: "user" as const, content: message },
    ],
  });

  const lastAI = [...result.messages]
    .reverse()
    .find(
      (m) => m.getType?.() === "ai" || (m as { type?: string }).type === "ai",
    );
  const responseText = String(lastAI?.content ?? "");

  await chatHistory.addAIChatMessage(responseText);

  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(responseText));
      controller.close();
    },
  });
};
