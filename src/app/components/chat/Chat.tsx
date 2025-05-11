import { db } from "@/db";
import MessageRecieved from "./MessageRecieved";
import MessageSent from "./MessageSent";
import { asc, eq, or } from "drizzle-orm";
import { Message, messages, Person } from "@/db/schema";
import MessageInput from "./MessageInput";

interface Props {
  person: Person;
}

export default async function Chat({ person }: Props) {
  const personMessages = await db.query.messages.findMany({
    where: or(
      eq(messages.senderId, person.id),
      eq(messages.receiverId, person.id),
    ),
    with: {
      sender: true,
      receiver: true,
    },
    orderBy: [asc(messages.createdAt)],
  });

  return (
    <div className="flex flex-col h-screen p-5">
      <div className="flex flex-col gap-5 overflow-y-auto">
        {personMessages.map((message: Message) => {
          return message.senderId === person.id ? (
            <MessageRecieved message={message} key={message.id} />
          ) : (
            <MessageSent message={message} key={message.id} />
          );
        })}
      </div>

      <MessageInput />
    </div>
  );
}
