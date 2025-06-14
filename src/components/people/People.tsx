import { db } from "@/db";
import { people, Person } from "@/db/models/people";
import { and, eq, ne } from "drizzle-orm";
import PeopleList from "./PeopleList";
import { ClueLink } from "@/db/models/clueLink";

export default async function People() {
  const murder = await db.query.murders.findFirst();
  if (!murder) {
    return <div>No murder found</div>;
  }
  const relatedPeople = (await db.query.people.findMany({
    where: and(
      eq(people.murderId, murder?.id),
      ne(people.id, murder?.victimId ?? 0),
    ),
    with: {
      clueLinks: true,
    },
  })) as (Person & { clueLinks: ClueLink[] })[];

  return <PeopleList people={relatedPeople} />;
}
