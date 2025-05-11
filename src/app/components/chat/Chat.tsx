"use client";

import MessageRecieved from "./MessageRecieved";
import MessageSent from "./MessageSent";
import { Message, Person } from "@/db/schema";
import MessageInput from "./MessageInput";
import { getMessages, sendMessage } from "@/services/message";
import { useState } from "react";

interface Props {
  person: Person;
  initialMessages: Message[];
}

export default function Chat({ person, initialMessages }: Props) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);

  const handleMessageSent = async (message: string) => {
    const optimisticMessage = {
      id: Date.now(),
      content: message,
      senderId: null,
      receiverId: person.id,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setMessages((prev) => [...prev, optimisticMessage as Message]);

    try {
      await sendMessage(message, null, person.id);
      setMessages(await getMessages(person.id));
    } catch (error) {
      console.error("Failed to send message:", error);
      setMessages((prev) =>
        prev.filter((msg) => msg.id !== optimisticMessage.id),
      );
    }
  };

  return (
    <div className="flex flex-col h-screen p-5">
      <div className="flex flex-col gap-5 overflow-y-auto">
        {messages.map((message: Message) => {
          return message.senderId === person.id ? (
            <MessageRecieved message={message} key={message.id} />
          ) : (
            <MessageSent message={message} key={message.id} />
          );
        })}
      </div>

      <MessageInput receiverId={person.id} messageSent={handleMessageSent} />
    </div>
  );
}
