"use server";

import { db } from "@/db";
import { ChatMessageRole, messages } from "@/db/models/messages";
import { asc, eq, or } from "drizzle-orm";
import { processMessage } from "./agents/suspect/suspect";
import { people } from "@/db/models/people";

export const getMessages = async (personId: number) => {
  return JSON.parse(
    JSON.stringify(
      await db.query.messages.findMany({
        where: or(eq(messages.suspectId, personId)),
        with: {
          suspect: true,
        },
        orderBy: [asc(messages.createdAt)],
      }),
    ),
  );
};

export const messageSuspect = async (suspectId: number, message: string) => {
  const suspect = await db.query.people.findFirst({
    where: eq(people.id, suspectId),
  });
  if (!suspect) {
    throw new Error("Suspect not found");
  }

  await db.insert(messages).values({
    role: ChatMessageRole.USER,
    content: message,
    suspectId: suspectId,
    murderId: suspect?.murderId,
    createdAt: new Date().getTime(),
    updatedAt: new Date().getTime(),
  });

  return await processMessage(suspectId, message, async (response) => {
    await db.insert(messages).values({
      role: ChatMessageRole.AI,
      content: response,
      suspectId: suspectId,
      murderId: suspect?.murderId,
      createdAt: new Date().getTime(),
      updatedAt: new Date().getTime(),
    });
  });
};
