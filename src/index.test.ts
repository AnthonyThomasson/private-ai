import { expect, test } from 'vitest'
import { AIMessage } from '@langchain/core/messages';
import { chatWithSuspect } from '.';

test('test basic chat', async () => {
  const response = await chatWithSuspect("Hello, world!");
  expect(response).toBeInstanceOf(AIMessage);
})