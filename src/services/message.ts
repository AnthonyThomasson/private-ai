"use server";

import { db } from "@/db";
import { messages } from "@/db/schema";
import { asc, eq, or } from "drizzle-orm";

export const getMessages = async (personId: number) => {
  return JSON.parse(
    JSON.stringify(
      await db.query.messages.findMany({
        where: or(
          eq(messages.senderId, personId),
          eq(messages.receiverId, personId),
        ),
        with: {
          sender: true,
          receiver: true,
        },
        orderBy: [asc(messages.createdAt)],
      }),
    ),
  );
};

export const sendMessage = async (
  message: string,
  senderId: number | null,
  receiverId: number | null,
) => {
  return JSON.parse(
    JSON.stringify(
      await db.insert(messages).values({
        content: message,
        senderId,
        receiverId,
        createdAt: new Date().getTime(),
        updatedAt: new Date().getTime(),
      }),
    ),
  );
};
