import { db } from "@/db";
import { murders } from "@/db/models/murders";
import { eq } from "drizzle-orm";

export const getMurderDetails = async (murderId: number) => {
  const murder = await db.query.murders.findFirst({
    where: eq(murders.id, murderId),
    with: {
      victim: true,
      perpetrator: true,
      clues: true,
    },
  });

  if (!murder) {
    throw new Error("Murder not found");
  }

  return `
		DESCRIPTION: ${murder.description}
		VICTIM: ${murder?.victim?.name}
		PERPETRATOR: ${murder?.perpetrator?.name}
		CLUES: \n${murder?.clues?.map((clue) => clue.description).join("\n\n- ")}
	`;
};
