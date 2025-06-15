import { db } from "@/db";
import Link from "next/link";
import Image from "next/image";

export default async function Page() {
  const murders = await db.query.murders.findMany();

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
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
