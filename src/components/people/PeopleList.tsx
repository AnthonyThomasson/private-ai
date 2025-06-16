"use client";

import { ClueLink } from "@/db/models/clueLink";
import { Person } from "@/db/models/people";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

interface PeopleListProps {
  murderId: number;
  people: (Person & { clueLinks: ClueLink[] })[];
}

export default function PeopleList({ murderId, people }: PeopleListProps) {
  const [showOnlyWithvisibleClues, setShowOnlyWithvisibleClues] =
    useState(true);

  return (
    <div className="flex flex-col gap-y-4 p-5">
      <Link href="/" className="w-full">
        <button className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 cursor-pointer">
          Back to murders
        </button>
      </Link>
      <button
        onClick={() => setShowOnlyWithvisibleClues(!showOnlyWithvisibleClues)}
        className="mb-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 cursor-pointer"
      >
        {showOnlyWithvisibleClues ? "Show All" : "Show Only No Clues"}
      </button>
      {people
        .filter(
          (person) =>
            !showOnlyWithvisibleClues ||
            person.clueLinks.some((clue) => clue.isVisible === 1),
        )
        .map((person) => (
          <a
            href={`/murders/${murderId}/person/${person.id}`}
            key={person.id}
            className="inline-flex items-center gap-x-4 justify-center p-5 text-base font-medium text-gray-500 bg-gray-50 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:bg-gray-800 dark:hover:bg-gray-700 dark:hover:text-white"
          >
            <Image
              className="rounded-full w-auto h-auto"
              src={`/story/characters/${person.id}.png`}
              alt={`an image of ${person.name}`}
              width={50}
              height={50}
            />
            <span className="w-full">{person.name}</span>
            <svg
              className="w-4 h-4 ms-2 rtl:rotate-180"
              aria-hidden="true"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 14 10"
            >
              <path
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M1 5h12m0 0L9 1m4 4L9 9"
              />
            </svg>
          </a>
        ))}
    </div>
  );
}
