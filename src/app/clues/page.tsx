import { db } from "@/db";
import { clueLinks } from "@/db/models/clueLink";
import { eq } from "drizzle-orm";
import Image from "next/image";

export default async function Clues() {
  const murder = await db.query.murders.findFirst();
  if (!murder) {
    return <div>No murder found</div>;
  }

  const currentClueLinks = await db.query.clueLinks.findMany({
    where: eq(clueLinks.murderId, murder.id),
    with: {
      clue: true,
      person: true,
    },
  });

  return (
    <div className="relative overflow-x-auto sm:rounded-lg m-10 h-screen">
      <h1 className="mb-4 text-4xl font-extrabold leading-none tracking-tight md:text-1xl lg:text-3xl">
        Clues
      </h1>
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
          {currentClueLinks.map((clueLink) => (
            <tr
              key={clueLink.id}
              className="bg-white border-b dark:bg-gray-800 dark:border-gray-700 border-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600"
            >
              <td className="px-6 py-4">{clueLink.clue?.description}</td>
              <td className="px-6 py-4">
                {clueLink.isVisible ? (
                  <span className="bg-green-100 text-green-800 text-xs font-medium me-2 px-2.5 py-0.5 rounded-sm dark:bg-green-900 dark:text-green-300">
                    Yes
                  </span>
                ) : (
                  <span className="bg-red-100 text-red-800 text-xs font-medium me-2 px-2.5 py-0.5 rounded-sm dark:bg-red-900 dark:text-red-300">
                    No
                  </span>
                )}
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
