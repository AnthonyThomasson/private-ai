import { db } from "@/db";
import { clueLinks as clueLinksTable } from "@/db/models/clueLink";
import { eq } from "drizzle-orm";
import CluesTable from "@/components/clues/CluesTable";
import { murders } from "@/db/models/murders";

export default async function Page({
  params,
}: {
  params: { murderId: string };
}) {
  const murderId = (await params).murderId;

  const murder = await db.query.murders.findFirst({
    where: eq(murders.id, Number(murderId)),
  });
  if (!murder) return <div>No murder found</div>;

  const currentClueLinks = await db.query.clueLinks.findMany({
    where: eq(clueLinksTable.murderId, murder.id),
    with: {
      clue: true,
      person: true,
    },
  });

  return (
    <CluesTable murderId={murder.id} initialClueLinks={currentClueLinks} />
  );
}
