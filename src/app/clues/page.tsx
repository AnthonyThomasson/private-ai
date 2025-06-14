import { db } from "@/db";
import { clueLinks as clueLinksTable } from "@/db/models/clueLink";
import { eq } from "drizzle-orm";
import CluesTable from "@/components/clues/CluesTable";

export default async function Clues() {
  const murder = await db.query.murders.findFirst();
  if (!murder) return <div>No murder found</div>;

  const currentClueLinks = await db.query.clueLinks.findMany({
    where: eq(clueLinksTable.murderId, murder.id),
    with: {
      clue: true,
      person: true,
    },
  });

  return <CluesTable initialClueLinks={currentClueLinks} />;
}
