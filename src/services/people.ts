"use server";
import { db } from "@/db";
import { murders } from "@/db/models/murders";
import { people } from "@/db/models/people";
import { count, eq } from "drizzle-orm";

export const getPersonProfile = async (personId: number) => {
  const person = await db.query.people.findFirst({
    where: eq(people.id, personId),
  });

  if (!person) {
    throw new Error("Person not found");
  }

  return `
		NAME: ${person.name}
		PERSONALITY: ${person.personality}
	`;
};

export const isPersonMurderer = async (personId: number) => {
  return (
    (
      await db
        .select({ count: count() })
        .from(murders)
        .where(eq(murders.perpetratorId, personId))
    )[0].count > 0
  );
};
