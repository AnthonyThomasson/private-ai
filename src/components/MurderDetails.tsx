import { db } from "@/db";
import Image from "next/image";

export default async function MurderDetails() {
  const murder = await db.query.murders.findFirst({
    with: {
      victim: true,
      perpetrator: true,
    },
  });

  return (
    <div className="p-5 flex flex-col gap-4">
      <a
        href="#"
        className="block max-w-sm p-6 bg-white border border-gray-200 rounded-lg shadow-sm hover:bg-gray-100 dark:bg-gray-800 dark:border-gray-700 dark:hover:bg-gray-700"
      >
        <h5 className="mb-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
          Murder Details
        </h5>
        <Image
          src={`/story/murders/${murder?.id}.png`}
          alt={`an image of a murder`}
          width={300}
          height={100}
          className="w-full my-5"
        />
        <p className="font-normal text-gray-700 dark:text-gray-400">
          {murder?.description}
        </p>
      </a>

      <h3 className="text-2xl dark:text-grey">Victim</h3>
      <div className="flex items-center gap-2">
        <div className="relative w-10 h-10 overflow-hidden bg-gray-100 rounded-full dark:bg-gray-600">
          <Image
            src={`/story/characters/${murder?.victim?.id}.png`}
            alt={`an image of ${murder?.victim?.name}`}
            width={40}
            height={40}
          />
        </div>
        <span className="dark:text-gray-800">{murder?.victim?.name}</span>
      </div>

      <h3 className="text-2xl dark:text-grey">Perpetrator</h3>
      <div className="flex items-center gap-2">
        <div className="relative w-10 h-10 overflow-hidden bg-gray-100 rounded-full dark:bg-gray-600">
          <svg
            className="absolute w-12 h-12 text-gray-400 -left-1"
            fill="currentColor"
            viewBox="0 0 20 20"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              fillRule="evenodd"
              d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
              clipRule="evenodd"
            ></path>
          </svg>
        </div>
        <span className="dark:text-gray-800">??????????</span>
      </div>

      <a
        href="/clues"
        className="text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 dark:bg-blue-600 dark:hover:bg-blue-700 focus:outline-none dark:focus:ring-blue-800 w-20"
      >
        Clues
      </a>
    </div>
  );
}
