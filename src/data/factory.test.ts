import { afterEach, beforeEach, expect, test } from 'vitest'
import { peopleFactory } from './factory';
import { db } from '.';
import { people } from './schema';

beforeEach(async () => {
  await db.delete(people).execute();
})

afterEach(async () => {
  await db.delete(people).execute();
})

test('test factories', async () => {
  await peopleFactory.create();
  
  const result = await db.query.people.findMany();
  expect(result).toBeDefined();
  expect(result.length).toBeGreaterThan(0);
})