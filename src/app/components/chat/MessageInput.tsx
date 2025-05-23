"use client";

import { useState } from "react";

type Props = {
  receiverId: number;
  sendMessage: (message: string) => void;
};

export default function MessageInput({ sendMessage }: Props) {
  const [message, setMessage] = useState("");

  return (
    <div className="sm:col-span-2 flex flex-col gap-2 items-end mt-auto">
      <label htmlFor="message" className="block mb-2 text-sm font-medium">
        Your message
      </label>
      <textarea
        id="message"
        rows={3}
        className="block p-2.5 w-full text-sm text-gray-900 bg-gray-50 rounded-lg shadow-sm border border-gray-300 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-primary-500 dark:focus:border-primary-500"
        placeholder="Write a message..."
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage(message);
            setMessage("");
          }
        }}
      ></textarea>
      <button
        type="submit"
        className="py-3 px-5 text-sm font-medium text-center text-white rounded-lg bg-primary-700 sm:w-fit hover:bg-primary-800 focus:ring-4 focus:outline-none focus:ring-primary-300 dark:bg-primary-600 dark:hover:bg-primary-700 dark:focus:ring-primary-800 cursor-pointer"
        onClick={() => {
          sendMessage(message);
          setMessage("");
        }}
      >
        Send message
      </button>
    </div>
  );
}
