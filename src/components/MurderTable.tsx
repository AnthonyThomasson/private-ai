"use client";
import { Murder } from "@/db/models/murders";
import { deleteChatHistory, deleteMurder } from "@/services/murder";
import Image from "next/image";
import Link from "next/link";

export default function MurderTable({
  murders,
  userToken,
}: {
  murders: Murder[];
  userToken: string;
}) {
  return (
    <div className="p-8 mx-auto max-w-7xl">
      <h1 className="text-2xl font-bold mb-4">Private AI</h1>
      <p className="text-gray-500 mb-4">
        Please select a crime scene you wish to investigate
      </p>
      <table className="w-full text-sm text-left rtl:text-right text-gray-500 dark:text-gray-400">
        <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
          <tr>
            <th scope="col" className="px-6 py-3">
              Image
            </th>
            <th scope="col" className="px-6 py-3">
              Description
            </th>
            <th scope="col" className="px-6 py-3">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {murders.map((murder) => (
            <tr
              key={murder.id}
              className="bg-white border-b dark:bg-gray-800 dark:border-gray-700 border-gray-200"
            >
              <td className="px-6 py-4">
                <Image
                  src={`/${murder.image}`}
                  alt={murder.description}
                  width={100}
                  height={100}
                />
              </td>
              <td className="px-6 py-4">
                <Link href={`/murders/${murder.id}`}>{murder.description}</Link>
              </td>
              <td className="px-6 py-4">
                <button
                  className="bg-red-700 text-white px-4 py-2 rounded-md cursor-pointer mb-2"
                  onClick={async () => {
                    await deleteMurder(murder.id);
                  }}
                >
                  Delete
                </button>
                <button
                  className="bg-red-400 text-white px-4 py-2 rounded-md cursor-pointer mb-2"
                  onClick={async () => {
                    "use client";
                    await deleteChatHistory(murder.id, userToken);
                  }}
                >
                  Clear Chat History
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
