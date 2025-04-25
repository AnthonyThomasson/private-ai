import { factory, later } from "@factory-js/factory";
import { faker } from "@faker-js/faker/locale/en";
import { people, evidences, murders, evidenceRelationships, Person, personRelationships } from './schema';
import { db } from ".";
import { femaleDescriptions, maleDescriptions } from "./factory_peopleDescriptions";
import { murderDescriptions } from "./factory_murderDescription";
import { locations } from './schema';

// People factory
export const peopleFactory = factory.define(
	{
		props: {
			name: () => faker.person.fullName(),
			age: () => faker.number.int({ min: 18, max: 80 }),
			gender: () => faker.person.sex() as 'male' | 'female',
			occupation: () => faker.person.jobTitle(),
			personality: () => JSON.stringify(faker.helpers.arrayElements([
				'Arrogant',
				'Shy',
				'Kind',
				'Brave',
				'Selfish',
				'Friendly',
				'Moody',
				'Charming',
				'Lazy',
				'Curious'
			], { min: 2, max: 3 })),
			description: () => faker.helpers.arrayElement([
				...maleDescriptions,	
				...femaleDescriptions
			])
		},
		vars: {
			friends: async ():Promise<Person[]> => [],
			spouse: async ():Promise<Person[]> => [],
			colleague: async ():Promise<Person[]> => [],
			family: async ():Promise<Person[]> => [],
			acquaintances: async ():Promise<Person[]> => [],
		},
	},
	async (data) => (await db.insert(people).values(data).returning())[0]
)
.props({
	name: ({ props }) => faker.person.fullName({ sex: props.gender === "male" ? "male" : "female" }) as string,
	description: ({ props }) => faker.helpers.arrayElement(props.gender === "male" ? maleDescriptions : femaleDescriptions) as string,
})
.after(async (person,vars) => {

	// Family
	(await vars.family).forEach(async (familyMember) => {
		await personRelationshipsFactory.vars({
			person1: async () => person,
			person2: async () => familyMember,
		}).props({
			relationshipType: () => 'family'
		})
		.create();
	});

	// Friends
	(await vars.friends).forEach(async (friend) => {
		await personRelationshipsFactory.vars({
			person1: async () => person,
			person2: async () => friend,
		}).props({
			relationshipType: () => 'friend'
		})
		.create();
	});

	// Colleague
	(await vars.colleague).forEach(async (coworker) => {
		await personRelationshipsFactory.vars({
			person1: async () => person,
			person2: async () => coworker,
		}).props({
			relationshipType: () => 'colleague'
		})
		.create();
	});

	// Acquaintances
	(await vars.acquaintances).forEach(async (acquaintance) => {
		await personRelationshipsFactory.vars({
			person1: async () => person,
			person2: async () => acquaintance,
		}).props({
			relationshipType: () => 'acquaintance'
		})
		.create();
	});

	// Romantic interests
	(await vars.spouse).forEach(async (spouse) => {
		await personRelationshipsFactory.vars({
			person1: async () => person,
			person2: async () => spouse,
		}).props({
			relationshipType: () => 'spouse'
		})
		.create();
	});
});

// Evidences factory
export const evidencesFactory = factory.define(
	{
		props: {
			description: () => faker.lorem.sentence(),
			incriminationRating: () => faker.number.int({ min: 1, max: 100 }),
			known: () => faker.datatype.boolean(),
			suspectId: later<number>(),
			locationId: later<number>()
		},
		vars: {
			suspect: async () => await peopleFactory.create(),
			location: async () => await locationsFactory.create()
		},
	},
	async (data) => (await db.insert(evidences).values(data).returning())[0]
).traits({
	known: {
		props: {
			known: () => true
		}
	},
	murderWeapon: {
		props: {
			incriminationRating: () => faker.number.int({ min: 90, max: 100 }),
			description: () => faker.helpers.arrayElement([
				"Knife", 
				"Handgun", 
				"Rope", 
				"Poison", 
				"Bat", 
				"Gun", 
				"Crossbow", 
				"Fist", 
			]),
		}
	},
	timeOfDeath: {
		props: {
			incriminationRating: () => 80,
			description: () => "The victim was killed at "+faker.date.recent().toLocaleString()
		}
	}
}).props({
	suspectId: async ({ vars }) => (await vars.suspect).id,
	locationId: async ({ vars }) => (await vars.location).id
});

// Murders factory
export const murdersFactory = factory.define(
	{
		props: {
			description: () => faker.helpers.arrayElement(murderDescriptions),
			victimId: later<number>(),
			perpetratorId: later<number>(),
			locationId: later<number>(),
		},
		vars: {
			victim: async () => await peopleFactory.create(),
			perpetrator: async () => await peopleFactory.create(),
			murderWeapon: async () => await evidencesFactory.use((t) => t.murderWeapon).create(),
			timeOfDeath: async () => await evidencesFactory.use((t) => t.timeOfDeath).create(),
			location: async () => await locationsFactory.create()
		},
	},
	async (data) => (await db.insert(murders).values(data).returning())[0]
).props({
	victimId: async ({ vars }) => (await vars.victim).id,
	perpetratorId: async ({ vars }) => (await vars.perpetrator).id,
	locationId: async ({ vars }) => (await vars.location).id
}).after(async (murder,vars) =>{
	await evidenceRelationshipsFactory.vars({
		evidence: async () => await vars.timeOfDeath,
		murder: async () => murder,
		reporter: () => null
	}).create();

	await evidenceRelationshipsFactory.vars({
		evidence: async () => await vars.murderWeapon,
		murder: async () => murder,
		reporter: () => null
	}).create();
});

// EvidenceRelationships factory
export const evidenceRelationshipsFactory = factory.define(
	{
		props: {
			evidenceId: later<number>(),
			murderId: later<number>(),
			reporterId: later<number|null>(),
			known: () => faker.datatype.boolean()
		},
		vars: {
			evidence: async () => await evidencesFactory.create(),
			murder: async () => await murdersFactory.create(),
			reporter: async ():Promise<any|null> => await peopleFactory.create()
		},
	},
	async (data) => (await db.insert(evidenceRelationships).values(data).returning())[0]
).props({
	reporterId: async ({ vars }) => (await vars.reporter)?.id,
	evidenceId: async ({ vars }) => (await vars.evidence).id,
	murderId: async ({ vars }) => (await vars.murder).id,
	known: async ({ vars }) => (await vars.evidence).known ?? false
});

// Locations factory
export const locationsFactory = factory.define(
	{
		props: {
			address: () => faker.location.streetAddress(),
			description: () => "A bar named 'The Local'. It's a popular spot for locals and tourists alike. It's a bit run down, but has a cozy feel. It's a bit dark, but has a warm glow. It's a bit loud, but has a cozy feel. It's a bit dark, but has a warm glow."
		},
		vars: {},
	},
	async (data) => (await db.insert(locations).values(data).returning())[0]
);

// Person Relationships factory
export const personRelationshipsFactory = factory.define(
	{
		props: {
			person1Id: later<number>(),
			person2Id: later<number>(),
			relationshipType: () => faker.helpers.arrayElement(['friend', 'family', 'colleague', 'acquaintance', 'spouse']),
		},
		vars: {
			person1: async () => await peopleFactory.create(),
			person2: async () => await peopleFactory.create(),
		},
	},
	async (data) => (await db.insert(personRelationships).values(data).returning())[0]
).props({
	person1Id: async ({ vars }) => (await vars.person1).id,
	person2Id: async ({ vars }) => (await vars.person2).id,
});
