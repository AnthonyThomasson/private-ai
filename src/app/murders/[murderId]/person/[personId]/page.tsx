import Chat from "@/components/chat/Chat";
import { getMessages } from "@/services/messages";
import { db } from "@/db";
import { people } from "@/db/models/people";
import { eq } from "drizzle-orm";

export default async function Page({
  params,
}: {
  params: { personId: string };
}) {
  const personId = (await params).personId;

  const person = await db.query.people.findFirst({
    where: eq(people.id, Number(personId)),
  });
  if (!person) {
    return <div>No person found in the database</div>;
  }
  return (
    <Chat
      person={JSON.parse(JSON.stringify(person))}
      initialMessages={await getMessages(person.id)}
    />
  );
}
