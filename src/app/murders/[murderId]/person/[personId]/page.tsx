import Chat from "@/components/chat/Chat";
import { getMessages } from "@/services/messages";
import { db } from "@/db";
import { people } from "@/db/models/people";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";

export default async function Page({
  params,
}: {
  params: { personId: string };
}) {
  const userToken = (await cookies()).get("user_token")?.value;
  if (!userToken) {
    throw new Error("User token not found");
  }

  const personId = (await params).personId;

  const person = await db.query.people.findFirst({
    where: eq(people.id, Number(personId)),
  });
  if (!person) {
    return <div>No person found in the database</div>;
  }
  return (
    <Chat
      userToken={userToken}
      person={JSON.parse(JSON.stringify(person))}
      initialMessages={await getMessages(person.id, userToken)}
    />
  );
}
