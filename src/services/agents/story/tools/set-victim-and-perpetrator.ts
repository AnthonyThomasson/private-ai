import { db } from "@/db";
import { murders } from "@/db/models/murders";
import { tool } from "@langchain/core/tools";
import { eq } from "drizzle-orm";
import { z } from "zod";

/** Creates a tool that sets victim, perpetrator, and location on the murder. */
export const createSetVictimAndPerpetratorTool = (getMurderId: () => number) =>
  tool(
    async ({
      victimId,
      perpetratorId,
      locationId,
    }: {
      victimId: number;
      perpetratorId: number;
      locationId: number;
    }) => {
      const mId = getMurderId();
      await db
        .update(murders)
        .set({ victimId, perpetratorId, locationId })
        .where(eq(murders.id, mId));
      console.log("🫆 Victim and perpetrator set");
      return "success";
    },
    {
      name: "set_victim_and_perpetrator",
      description:
        "Link the victim and perpetrator to the murder, and set the murder location. Call after creating both people.",
      schema: z.object({
        victimId: z.number().describe("personId of the victim"),
        perpetratorId: z.number().describe("personId of the perpetrator"),
        locationId: z
          .number()
          .describe("locationId of the victim (the crime scene location)"),
      }),
    },
  );
