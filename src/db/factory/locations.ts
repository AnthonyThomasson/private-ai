import { factory } from "@factory-js/factory";
import { faker } from "@faker-js/faker/locale/en";
import { db } from "..";
import { locations } from "../models/location";

export const locationsFactory = factory.define(
  {
    props: {
      address: () => faker.location.streetAddress(),
      description: () => faker.lorem.sentence(),
    },
    vars: {},
  },
  async (data) => (await db.insert(locations).values(data).returning())[0],
);
