import { db } from "@/db";
import { people } from "@/db/models/people";
import { and, eq, ne } from "drizzle-orm";
import Image from "next/image";

export default async function People() {
  const murder = await db.query.murders.findFirst();
  if (!murder) {
    return <div>No murder found</div>;
  }
  const relatedPeople = await db.query.people.findMany({
    where: and(
      eq(people.murderId, murder?.id),
      ne(people.id, murder?.victimId ?? 0),
    ),
  });

  return (
    <div className="flex flex-col gap-y-4 p-5">
      {relatedPeople.map((person) => (
        <a
          href={`/person/${person.id}`}
          key={person.id}
          className={`inline-flex items-center gap-x-4 justify-center p-5 text-base font-medium text-gray-500 bg-gray-50 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:bg-gray-800 dark:hover:bg-gray-700 dark:hover:text-white`}
        >
          <Image
            className="rounded-full w-auto h-auto"
            src={`/story/characters/${person.id}.png`}
            alt={`an image of ${person.name}`}
            width={50}
            height={50}
          ></Image>
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
