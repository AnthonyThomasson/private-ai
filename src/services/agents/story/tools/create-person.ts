import { db } from "@/db";
import { locations } from "@/db/models/location";
import { people } from "@/db/models/people";
import { tool } from "@langchain/core/tools";
import { count, eq } from "drizzle-orm";
import { z } from "zod";

const DEFAULT_DESCRIPTION =
  "Create a person in the murder investigation. Returns personId.";

const DEFAULT_LOCATION_DESCRIPTION =
  "A 1-sentence description of the physical space where this person is located. Do NOT mention the person.";
const FIX_LOCATION_DESCRIPTION =
  "A 1-sentence description of the physical space. Do NOT mention the person.";

/** Creates a tool that inserts a person and location for a murder. Supports fix-specific options. */
export const createCreatePersonTool = (
  getMurderId: () => number,
  options?: {
    toolDescription?: string;
    logPrefix?: string;
  },
) => {
  const toolDescription = options?.toolDescription ?? DEFAULT_DESCRIPTION;
  const locationDescription = options?.toolDescription
    ? FIX_LOCATION_DESCRIPTION
    : DEFAULT_LOCATION_DESCRIPTION;
  const logPrefix = options?.logPrefix ? `${options.logPrefix} ` : "";

  return tool(
    async ({
      name,
      age,
      gender,
      occupation,
      description,
      personality,
      motive,
      type,
      address,
      locationDescription: locDesc,
    }: {
      name: string;
      age: number;
      gender: "male" | "female";
      occupation: string;
      description: string;
      personality: string;
      motive?: string;
      type?: "witness" | "csi";
      address: string;
      locationDescription: string;
    }) => {
      const mId = getMurderId();

      const existing = await db
        .select({ count: count() })
        .from(people)
        .where(eq(people.name, name));
      if (existing[0].count > 0) {
        return `RETRY: A person named "${name}" already exists. Choose a different name.`;
      }

      const [location] = await db
        .insert(locations)
        .values({ address, description: locDesc, murderId: mId })
        .returning();

      const [person] = await db
        .insert(people)
        .values({
          name,
          age,
          gender,
          occupation,
          description,
          personality,
          motive: motive ?? null,
          type: type ?? "witness",
          locationId: location.id,
          murderId: mId,
        })
        .returning();

      console.log(`👤 ${logPrefix}Person created:`, name, `(${occupation})`);
      return JSON.stringify({ personId: person.id, locationId: location.id });
    },
    {
      name: "create_person",
      description: toolDescription,
      schema: z.object({
        name: z.string().describe("Full name of the person"),
        age: z.number().describe("Age of the person"),
        gender: z.enum(["male", "female"]).describe("Gender of the person"),
        occupation: z.string().describe("Occupation of the person"),
        description: z
          .string()
          .describe("A 1-sentence physical description of the person"),
        personality: z
          .string()
          .describe("Comma-separated single-word personality traits"),
        motive: z
          .string()
          .optional()
          .describe(
            "The perpetrator's specific motive for the murder. Only set this for the perpetrator — leave empty for all other people.",
          ),
        type: z
          .enum(["witness", "csi"])
          .default("witness")
          .describe(
            'Person type: "csi" for forensic investigators (crime lab analysts, medical examiners, ballistics experts, etc.) who process physical evidence; "witness" for all other people. CSI characters MUST NOT be the perpetrator.',
          ),
        address: z
          .string()
          .describe("The address where this person lives or works"),
        locationDescription: z.string().describe(locationDescription),
      }),
    },
  );
};
