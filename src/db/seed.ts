import { faker } from "@faker-js/faker/locale/en";
import { db } from ".";
import {
  evidencesFactory,
  locationsFactory,
  murdersFactory,
  peopleFactory,
  personRelationshipsFactory,
} from "./factory";
import {
  clues,
  evidenceRelationships,
  evidences,
  locations,
  murders,
  people,
  Person,
  personRelationships,
} from "./schema";

async function clearDatabase() {
  await db.delete(evidenceRelationships).execute({ cascade: true });
  await db.delete(personRelationships).execute({ cascade: true });
  await db.delete(murders).execute({ cascade: true });
  await db.delete(evidences).execute({ cascade: true });
  await db.delete(locations).execute({ cascade: true });
  await db.delete(people).execute({ cascade: true });
}

const createRandomRelationship = async (person1: Person, person2: Person) => {
  const relationshipType = faker.helpers.arrayElement([
    "friend",
    "family",
    "colleague",
    "acquaintance",
  ]);
  await personRelationshipsFactory
    .vars({
      person1: async () => person1,
      person2: async () => person2,
    })
    .props({
      relationshipType: () => relationshipType,
    })
    .create();
};

export const seed = async () => {
  console.log("🌱 Seeding database...");
  await clearDatabase();

  const suspects: Person[] = [];
  for (let i = 0; i < 5; i++) {
    const suspect = await peopleFactory
      .vars({
        spouse: async () => [await peopleFactory.create()],
        friends: async () => await peopleFactory.createList(5),
        acquaintances: async () => await peopleFactory.createList(5),
      })
      .create();
    suspects.push(suspect);
    if (suspects.length > 1) {
      do {
        const randomSuspect = faker.helpers.arrayElement(suspects);
        if (randomSuspect !== suspect) {
          await createRandomRelationship(suspect, randomSuspect);
          break;
        }
      } while (true);
    }
  }

  // Murder location
  const murderLocation = locationsFactory
    .props({
      description: () =>
        "The alley was narrow and grimy, squeezed between crumbling brick walls. A broken streetlamp cast a weak, flickering light over the cracked concrete, where scraps of paper and glass were scattered. The air hung heavy with the smell of oil and damp trash.",
    })
    .create();
  const murder = await murdersFactory
    .props({
      description: () =>
        "A figure lies sprawled across a cracked concrete floor, a gun tossed nearby.",
    })
    .vars({
      perpetrator: async () => faker.helpers.arrayElement(suspects),
      victim: async () => faker.helpers.arrayElement(suspects),
      location: async () => murderLocation,
      murderWeapon: async () =>
        await evidencesFactory
          .use((t) => t.murderWeapon)
          .props({
            known: () => true,
            description: () =>
              "A Glock 19 Gen5 featuring a matte black finish, a 4.02-inch barrel, and a 15-round magazine. It has standard Glock night sights, a smooth, no-finger-groove grip, and slight holster wear on the slide, showing it’s been carried but well-maintained. The trigger is crisp, and the internals are clean, making it ready for reliable everyday use.",
          })
          .create(),
    })
    .create();

  await db.insert(clues).values([
    {
      description:
        "A receipt from the bar 'The Local' was found in the victim's pocket",
      murderId: murder.id,
    },
  ]);
};

seed().catch(console.error);
