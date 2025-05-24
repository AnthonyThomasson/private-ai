"use client";

import MessageRecieved from "./MessageRecieved";
import MessageSent from "./MessageSent";
import { Message } from "@/db/models/messages";
import MessageInput from "./MessageInput";
import { useAiChatter } from "@/app/hooks/useAiChatter";
import Image from "next/image";
import { useRef, useEffect } from "react";
import { Person } from "@/db/models/people";

interface Props {
  person: Person;
  initialMessages: Message[];
}

export default function Chat({ person, initialMessages }: Props) {
  const { messages, isTyping, sendMessage } = useAiChatter({
    person,
    initialMessages,
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

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
        <div ref={messagesEndRef} />
      </div>
      {isTyping && (
        <Image
          src="/typing-indicator.gif"
          alt="Typing indicator"
          width={340}
          height={460}
          className="w-20 h-15"
        />
      )}

      <MessageInput receiverId={person.id} sendMessage={sendMessage} />
    </div>
  );
}
