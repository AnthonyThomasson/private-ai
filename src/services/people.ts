import { db } from "@/db";
import { people } from "@/db/models/people";
import { eq } from "drizzle-orm";

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
