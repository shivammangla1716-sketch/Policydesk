import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeGeneratedAnswer } from '../services/ai.js';

test('uses valid structured citations when Gemini omits inline citation markers', () => {
  assert.deepEqual(
    normalizeGeneratedAnswer({
      answer: 'A student can clear a backlog by registering again.',
      citations: [2],
    }, 5),
    {
      text: 'A student can clear a backlog by registering again. [2]',
      indices: [2],
    },
  );
});
