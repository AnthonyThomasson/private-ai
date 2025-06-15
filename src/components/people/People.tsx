import { db } from "@/db";
import { people, Person } from "@/db/models/people";
import { and, eq, ne } from "drizzle-orm";
import PeopleList from "./PeopleList";
import { ClueLink } from "@/db/models/clueLink";
import { murders } from "@/db/models/murders";

export default async function People({ murderId }: { murderId: number }) {
  const murder = await db.query.murders.findFirst({
    where: eq(murders.id, murderId),
  });

  const relatedPeople = (await db.query.people.findMany({
    where: and(
      eq(people.murderId, murderId),
      ne(people.id, murder?.victimId ?? 0),
    ),
    with: {
      clueLinks: true,
    },
  })) as (Person & { clueLinks: ClueLink[] })[];

  return <PeopleList murderId={murderId} people={relatedPeople} />;
}
