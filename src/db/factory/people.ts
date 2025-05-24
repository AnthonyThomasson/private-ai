// import { factory, later } from "@factory-js/factory";
// import { faker } from "@faker-js/faker/locale/en";

// import { db } from "..";
// import {
//   femaleDescriptions,
//   maleDescriptions,
// } from "../factory_peopleDescriptions";
// import { murderDescriptions } from "../factory_murderDescription";
// import { locations } from "../models/location";
// import { people } from "../models/people";
// import { personRelationships } from "../models/people";
// import { evidences } from "./models/evidences";
// import { murders } from "../models/murders";
// import { evidenceRelationships } from "./models/evidences";
// import { Person } from "../models/people";

// // People factory
// export const peopleFactory = factory.define(
//   {
//     props: {
//       name: () => faker.person.fullName(),
//       age: () => faker.number.int({ min: 18, max: 80 }),
//       gender: () => faker.person.sex() as "male" | "female",
//       occupation: () => faker.person.jobTitle(),
//       personality: () =>
//         JSON.stringify(
//           faker.helpers.arrayElements(
//             [
//               "Arrogant",
//               "Shy",
//               "Kind",
//               "Brave",
//               "Selfish",
//               "Friendly",
//               "Moody",
//               "Charming",
//               "Lazy",
//               "Curious",
//             ],
//             { min: 2, max: 3 },
//           ),
//         ),
//       description: () => faker.lorem.sentence(),
//     },
//   },
//   async (data) => (await db.insert(people).values(data).returning())[0],
// );

// // Evi
