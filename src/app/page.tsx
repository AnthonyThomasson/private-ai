import { db } from "@/db";
import Chat from "../components/chat/Chat";
import { getMessages } from "@/services/messages";

export default async function Home() {
  const person = await db.query.people.findFirst();

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
