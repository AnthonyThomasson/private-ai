"use client";

import Image from "next/image";
import { useState } from "react";

type ClueLinkWithRelations = {
  id: number;
  description: string;
  murderId: number | null;
  clueId: number | null;
  personId: number | null;
  isVisible: number;
  clue: {
    id: number;
    description: string;
    murderId: number | null;
  } | null;
  person: {
    id: number;
    name: string;
    image: string | null;
  } | null;
};

export default function CluesTable({
  initialClueLinks,
}: {
  murderId: number;
  initialClueLinks: ClueLinkWithRelations[];
}) {
  const [showHidden, setShowHidden] = useState(false);

  const visibleClueLinks = initialClueLinks.filter(
    (clueLink) => clueLink.isVisible || showHidden,
  );

  return (
    <div className="relative overflow-x-auto sm:rounded-lg m-10 h-screen">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-4xl font-extrabold leading-none tracking-tight md:text-1xl lg:text-3xl">
          Clues
        </h1>
        <button
          onClick={() => setShowHidden(!showHidden)}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {showHidden ? "Hide Hidden Clues" : "Show Hidden Clues"}
        </button>
      </div>
      <table className="w-full text-sm text-left rtl:text-right text-gray-500 dark:text-gray-400">
        <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
          <tr>
            <th scope="col" className="px-6 py-3">
              Clue
            </th>
            <th scope="col" className="px-6 py-3">
              Visible
            </th>
            <th scope="col" className="px-6 py-3">
              Person
            </th>
            <th scope="col" className="px-6 py-3">
              Relation
            </th>
          </tr>
        </thead>
        <tbody>
          {visibleClueLinks.map((clueLink) => (
            <tr
              key={clueLink.id}
              className="bg-white border-b dark:bg-gray-800 dark:border-gray-700 border-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600"
            >
              <td className="px-6 py-4">{clueLink.clue?.description}</td>
              <td className="px-6 py-4">
                <span
                  className={`text-xs font-medium me-2 px-2.5 py-0.5 rounded-sm ${
                    clueLink.isVisible
                      ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
                      : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300"
                  }`}
                >
                  {clueLink.isVisible ? "Yes" : "No"}
                </span>
              </td>
              <td
                scope="row"
                className="flex items-center px-6 py-4 text-gray-900 whitespace-nowrap dark:text-white"
              >
                <Image
                  className="w-10 h-10 rounded-full"
                  width={40}
                  height={40}
                  src={`/story/characters/${clueLink.person?.id}.png`}
                  alt={`an image of ${clueLink.person?.name}`}
                ></Image>
              </td>
              <td className="px-6 py-4">{clueLink.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
