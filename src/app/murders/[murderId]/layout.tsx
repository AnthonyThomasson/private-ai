import type { Metadata } from "next";
import People from "@/components/people/People";
import { db } from "@/db";
import React from "react";
import MurderDetails from "@/components/MurderDetails";
import { murders } from "@/db/models/murders";
import { eq } from "drizzle-orm";

export const metadata: Metadata = {
  title: "Private AI",
  description: "AI powered murder mystery",
};

export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactElement;
  params: Promise<{ murderId: string }>;
}) {
  const { murderId } = await params;
  const murder = await db.query.murders.findFirst({
    where: eq(murders.id, Number(murderId)),
  });
  if (!murder) {
    return <div>No murder found</div>;
  }

  return (
    <div className="flex">
      <div className="w-1/4 bg-gray-200">
        <People murderId={murder.id} />
      </div>
      <div className="w-2/4 bg-gray-300">{children}</div>
      <div className="w-1/4 bg-gray-400">
        <MurderDetails murderId={murder.id} />
      </div>
    </div>
  );
}
