"use server";
import { db } from "@/db";
import { clues } from "@/db/models/clues";
import { messages } from "@/db/models/messages";
import { people } from "@/db/models/people";
import { clueLinks } from "@/db/models/clueLink";
import { and, eq } from "drizzle-orm";
import { murders } from "@/db/models/murders";

export const deleteMurder = async (murderId: number) => {
  await db.delete(murders).where(eq(murders.id, murderId));
  await db.delete(people).where(eq(people.murderId, murderId));
  await db.delete(messages).where(eq(messages.murderId, murderId));
  await db.delete(clues).where(eq(clues.murderId, murderId));
  await db.delete(clueLinks).where(eq(clueLinks.murderId, murderId));
};

export const deleteChatHistory = async (
  murderId: number,
  userToken: string,
) => {
  await db
    .delete(messages)
    .where(
      and(eq(messages.murderId, murderId), eq(messages.userToken, userToken)),
    );
};

export const getMurderDetails = async (murderId: number) => {
  const murder = await db.query.murders.findFirst({
    where: eq(murders.id, murderId),
    with: {
      victim: true,
      perpetrator: true,
      clueLinks: {
        with: {
          clue: true,
        },
      },
    },
  });

  if (!murder) {
    throw new Error("Murder not found");
  }

  return `
		DESCRIPTION: ${murder.description}
		VICTIM: ${murder?.victim?.name}
	`;
};
