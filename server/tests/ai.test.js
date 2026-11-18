import test from 'node:test';
import assert from 'node:assert/strict';
import { createGeminiAI, normalizeGeneratedAnswer } from '../services/ai.js';

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

test('falls back to the low-latency generation model when the primary model is overloaded', async () => {
  const originalFetch = global.fetch;
  const requestedModels = [];
  global.fetch = async (url) => {
    requestedModels.push(String(url));
    if (String(url).includes('gemini-3.6-flash')) {
      return new Response(JSON.stringify({ error: { message: 'High demand' } }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return Response.json({
      candidates: [{ content: { parts: [{ text: JSON.stringify({ answer: 'A 7.0 CGPA is required. [1]', citations: [1] }) }] } }],
    });
  };

  try {
    const ai = createGeminiAI({
      geminiKey: 'test-key',
      generationModel: 'gemini-3.6-flash',
      fallbackGenerationModel: 'gemini-3.5-flash-lite',
    });
    const result = await ai.answer('What CGPA is required?', [{ title: 'Placement', section: '', text: 'A 7.0 CGPA is required.' }]);
    assert.equal(result.text, 'A 7.0 CGPA is required. [1]');
    assert.deepEqual(requestedModels.map((url) => url.match(/models\/([^:]+)/)[1]), [
      'gemini-3.6-flash',
      'gemini-3.5-flash-lite',
    ]);
  } finally {
    global.fetch = originalFetch;
  }
});
