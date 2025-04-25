import { config } from 'dotenv';
import { chat } from './agents/suspect';
import { createInterface } from 'readline';
import { locations,people, personRelationships } from './data/schema';
import { faker } from '@faker-js/faker/locale/en';
import { db } from './data';
import { and, eq, inArray, or, sql } from 'drizzle-orm';
import { seed } from './data/seed';
import { locationsFactory } from './data/factory';
config();

const rl = createInterface({
	input: process.stdin,
	output: process.stdout
});

export async function chatWithSuspect(message: string, characterProfile, murderProfile, locationProfile) {
	return await chat(message, characterProfile, murderProfile, locationProfile)
}

async function main() {

	await seed();

	const friendsQuery = await db
		.select()
		.from(personRelationships)
		.where(eq(personRelationships.relationshipType, 'friend'))
		.groupBy(personRelationships.person1Id)
		.having(sql`COUNT(*) > 1`);

	const suspectIds = friendsQuery.map(f => f.person1Id).filter(id => id !== null);
	const suspects = await db.query.people.findMany({
		where: inArray(people.id, suspectIds),
	});

	const murder = await db.query.murders.findFirst();
	if (!murder) {
		console.error("No murder found. Exiting...");
		return;
	}

	const suspect = faker.helpers.arrayElement(suspects);

	const location = await locationsFactory.create();
	
	const spouseRelationships = await db.query.personRelationships.findMany({
    where: and(
      or(
        eq(personRelationships.person1Id, suspect.id), eq(personRelationships.person2Id, suspect.id)
      ), 
      eq(personRelationships.relationshipType, 'spouse')
    ),
  })
  const spouseIds = spouseRelationships.map((f) => f.person1Id === suspect.id ? f.person2Id : f.person1Id).filter((id): id is number => id !== null);
  const spouse = await db.query.people.findMany({
    where: inArray(people.id, spouseIds)
  })

  const friendsRelationships = await db.query.personRelationships.findMany({
    where: and(
      or(
        eq(personRelationships.person1Id, suspect.id), eq(personRelationships.person2Id, suspect.id)
      ), 
      eq(personRelationships.relationshipType, 'friend')
    ),
  })
  const friendIds = friendsRelationships.map((f) => f.person1Id === suspect.id ? f.person2Id : f.person1Id).filter((id): id is number => id !== null);
  const friends = await db.query.people.findMany({
    where: inArray(people.id, friendIds)
  })

  const acquaintancesRelationships = await db.query.personRelationships.findMany({
    where: and(
      or(
        eq(personRelationships.person1Id, suspect.id), eq(personRelationships.person2Id, suspect.id)
      ), 
      eq(personRelationships.relationshipType, 'acquaintance')
    ),
  })
  const acquaintanceIds = acquaintancesRelationships.map((f) => f.person1Id === suspect.id ? f.person2Id : f.person1Id).filter((id): id is number => id !== null);
  const acquaintances = await db.query.people.findMany({
    where: inArray(people.id, acquaintanceIds)
  })

  


  const victim = await db.query.people.findFirst({
    where: eq(people.id, murder.victimId ?? 0)
  })

  const perpetrator = await db.query.people.findFirst({
    where: eq(people.id, murder.perpetratorId ?? 0)
  })

  const murderLocation = await db.query.locations.findFirst({
    where: eq(locations.id, murder.locationId ?? 0)
  })

let characterProfile = {
	...suspect,
	friends,
	spouse,
	acquaintances
} as any;

  let murderProfile = {
    ...murder, 
    victim: victim, 
    perpetrator: perpetrator,
	clues: [
		"A receipt from a bar called 'The Local' was found in the victim's pocket",
	]
  } as any;
  let locationProfile = location as any;

  characterProfile.friends = characterProfile.friends.map(friend => {
    return {
      name: friend.name,
    }
  })
  characterProfile.spouse = characterProfile.spouse.map(spouse => {
    return {
      name: spouse.name,
    }
  })
  characterProfile.acquaintances = characterProfile.acquaintances.map(acquaintance => {
    return {
      name: acquaintance.name,
    }
  })

 // remove murder details
  delete murderProfile.description;
  delete murderProfile.perpetratorId;
  delete murderProfile.victimId;
  delete murderProfile.locationId;


  console.log("characterProfile",characterProfile);
  console.log("murderProfile",murderProfile);
  console.log("locationProfile",locationProfile);

	while (true) {
		const message = await new Promise<string>(
			resolve => rl.question('You: ', resolve)
		);
		const response = await chatWithSuspect(message,characterProfile,murderProfile,locationProfile);
		console.log(`Suspect: ${response.messages[response.messages.length - 1].content}`);
	}
}

main().catch(console.error);