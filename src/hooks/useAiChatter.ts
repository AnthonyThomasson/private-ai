import { useState } from "react";
import { getMessages } from "@/services/messages";
import { Person } from "@/db/models/people";
import { ChatMessageRole, Message } from "@/db/models/messages";

interface UseMessageHandlerProps {
  person: Person;
  initialMessages: Message[];
}

export function useAiChatter({
  person,
  initialMessages,
}: UseMessageHandlerProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [isTyping, setIsTyping] = useState(false);

  const sendMessage = async (message: string) => {
    console.log(person);

    const optimisticMessage = {
      id: Date.now(),
      content: message,
      role: ChatMessageRole.USER,
      suspectId: person.id,
      murderId: person.murderId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      suspect: person,
    };
    setMessages((prev) => [...prev, optimisticMessage as Message]);

    setIsTyping(true);

    try {
      const response = await fetch("/api/messages", {
        method: "POST",
        body: JSON.stringify({
          message,
          suspectId: person.id,
        }),
      });

      setIsTyping(false);
      const streamingMessage = {
        id: Date.now(),
        content: "",
        role: ChatMessageRole.AI,
        suspectId: person.id,
        murderId: person.murderId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        suspect: person,
      };
      setMessages((prev) => [...prev, streamingMessage as Message]);

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let accumulatedContent = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          accumulatedContent += chunk;
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === streamingMessage.id
                ? { ...msg, content: accumulatedContent }
                : msg,
            ),
          );
        }
      }

      setMessages(await getMessages(person.id));
    } catch (error) {
      console.error("Failed to send message:", error);
      setMessages((prev) =>
        prev.filter((msg) => msg.id !== optimisticMessage.id),
      );
    }
  };

  return {
    messages,
    isTyping,
    sendMessage,
  };
}
