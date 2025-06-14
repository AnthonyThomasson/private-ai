import type { Metadata } from "next";
import "./globals.css";
import MurderDetails from "../components/MurderDetails";
import People from "@/components/people/People";
import { db } from "@/db";
import React from "react";

export const metadata: Metadata = {
  title: "Private AI",
  description: "AI powered murder mystery",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactElement;
}) {
  const murder = await db.query.murders.findFirst();
  if (!murder) {
    return <div>No murder found</div>;
  }

  return (
    <html lang="en">
      <body className={`antialiased`}>
        <div className="flex">
          <div className="w-1/4 bg-gray-200">
            <People />
          </div>
          <div className="w-2/4 bg-gray-300">{children}</div>
          <div className="w-1/4 bg-gray-400">
            <MurderDetails />
          </div>
        </div>
        <script src="node_modules/flowbite/dist/flowbite.min.js" async></script>
      </body>
    </html>
  );
}
