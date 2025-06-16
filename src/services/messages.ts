"use server";

import { db } from "@/db";
import { people, Person } from "@/db/models/people";
import { and, eq } from "drizzle-orm";
import { processMessage } from "./agents/suspect/suspect";
import { messages } from "@/db/models/messages";

export const getMessages = async (personId: number, userToken: string) => {
  const person = (await db.query.people.findFirst({
    where: eq(people.id, personId),
  })) as Person;

  if (!person) {
    return [];
  }

  return JSON.parse(
    JSON.stringify(
      await db.query.messages.findMany({
        where: and(
          eq(messages.suspectId, personId),
          eq(messages.userToken, userToken),
        ),
        orderBy: messages.createdAt,
        with: {
          suspect: true,
        },
      }),
    ),
  );
};

export const messageSuspect = async (suspectId: number, message: string) => {
  return await processMessage(suspectId, message);
};
