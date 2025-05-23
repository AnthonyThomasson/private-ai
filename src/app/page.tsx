import { db } from "@/db";
import Chat from "./components/chat/Chat";
import MurderDetails from "./components/MurderDetails";
import { getMessages } from "@/services/message";

export default async function Home() {
  const person = await db.query.people.findFirst();

  if (!person) {
    return <div>No person found in the database</div>;
  }

  return (
    <div className="flex">
      <div className="w-1/4 bg-gray-200">
        <MurderDetails />
      </div>
      <div className="w-2/4 bg-gray-300">
        <Chat
          person={JSON.parse(JSON.stringify(person))}
          initialMessages={await getMessages(person.id)}
        />
      </div>
      <div className="w-1/4 bg-gray-400">
        <h1>Section 3</h1>
      </div>
    </div>
  );
}
