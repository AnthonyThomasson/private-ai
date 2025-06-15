"use server";

import { db } from "@/db";
import { messages } from "@/db/models/messages";
import { asc, eq, or } from "drizzle-orm";
import { processMessage } from "./agents/suspect/suspect";

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
  return await processMessage(suspectId, message);
};
