"use client";

import MessageRecieved from "./MessageRecieved";
import MessageSent from "./MessageSent";
import { Message } from "@/db/models/messages";
import MessageInput from "./MessageInput";
import { useAiChatter } from "@/hooks/useAiChatter";
import Image from "next/image";
import { useRef, useEffect } from "react";
import { Person } from "@/db/models/people";
import { isPersonMurderer } from "@/services/people";

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
      <div className="overflow-y-auto">
        <div className="flex flex-col items-center">
          <div className="w-full max-w-sm bg-white border border-gray-200 rounded-lg shadow-sm dark:bg-gray-800 dark:border-gray-700 p-5">
            <div className="flex flex-col items-center pb-10">
              <Image
                className="w-24 h-24 mb-3 rounded-full shadow-lg"
                src={`/story/characters/${person.id}.png`}
                alt={`an image of ${person.name}`}
                width={96}
                height={96}
              />
              <h5 className="mb-1 text-xl font-medium text-gray-900 dark:text-white">
                {person.name}
              </h5>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {person.occupation}
              </span>
            </div>
            <div className="flex flex-col items-center">
              <button
                className="bg-blue-500 text-white px-4 py-2 rounded-md cursor-pointer"
                onClick={async () => {
                  const isMurderer = await isPersonMurderer(person.id);
                  if (isMurderer) {
                    alert("Person is a murderer");
                  } else {
                    alert("Person is not a murderer");
                  }
                }}
              >
                Arrest
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-5 mt-10">
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
      </div>

      <MessageInput receiverId={person.id} sendMessage={sendMessage} />
    </div>
  );
}
