import { factory, later } from "@factory-js/factory";
import { faker } from "@faker-js/faker/locale/en";
import { db } from "..";
import { murders } from "../models/murders";
import { locationsFactory } from "./locations";
import { eq } from "drizzle-orm";

export const murdersFactory = factory
  .define(
    {
      props: {
        description: () => faker.lorem.sentence(),
        locationId: later<number>(),
      },
      vars: {
        location: async () => await locationsFactory.create(),
      },
    },
    async (data) => {
      const [record] = await db.insert(murders).values(data).returning();
      return await db.query.murders.findFirst({
        where: eq(murders.id, record.id),
        with: {
          location: true,
        },
      });
    },
  )
  .props({
    locationId: async ({ vars }) => (await vars.location).id,
  });
