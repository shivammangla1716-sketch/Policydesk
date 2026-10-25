import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRetrievalQuery, chunkDocument, cosineSimilarity, selectSources } from '../services/retrieval.js';

test('paragraph chunks preserve headings and overlap when long sections split', () => {
  const words = Array.from({ length: 650 }, (_, i) => `word${i}`).join(' ');
  const chunks = chunkDocument(`Annual leave\n\n${words}`);
  assert.ok(chunks.length >= 3);
  assert.equal(chunks[0].section, 'Annual leave');
  assert.ok(chunks[0].text.includes('word0'));
  assert.ok(chunks[0].text.split(/\s+/).some(word => chunks[1].text.includes(word)));
  assert.ok(chunks.at(-1).text.includes('word649'));
});

test('blank text cannot create a searchable document', () => {
  assert.deepEqual(chunkDocument(' \n\t '), []);
});

test('short policy facts and extracted list items are never discarded as headings', () => {
  const chunks = chunkDocument('Annual leave\n\nAnnual leave: 24 days\n\nEmployees receive health insurance from day one\n\nSick leave: 10 days\n\nRequests must be submitted in the HR portal.');
  const indexed = chunks.map(chunk => chunk.text).join('\n');
  assert.match(indexed, /Annual leave: 24 days/);
  assert.match(indexed, /Employees receive health insurance from day one/);
  assert.match(indexed, /Sick leave: 10 days/);
});

test('built-in follow-up questions use the latest user question for retrieval', () => {
  const messages = [
    { role: 'user', text: 'Can I work remotely?' },
    { role: 'assistant', text: 'Yes, under the hybrid work policy.' },
  ];
  assert.equal(buildRetrievalQuery('Are there any exceptions or conditions?', messages), 'Can I work remotely?\nAre there any exceptions or conditions?');
  assert.equal(buildRetrievalQuery('What are the key things I should know about this?', messages), 'Can I work remotely?\nWhat are the key things I should know about this?');
  assert.equal(buildRetrievalQuery('How many annual leave days do I receive?', messages), 'How many annual leave days do I receive?');
});

test('cosine rejects unusable vectors and ranks related vectors above unrelated ones', () => {
  assert.equal(cosineSimilarity([1, 0], [1, 0]), 1);
  assert.equal(cosineSimilarity([1, 0], [0, 1]), 0);
  assert.equal(cosineSimilarity([0, 0], [1, 0]), 0);
  assert.equal(cosineSimilarity([1], [1, 0]), 0);
  assert.equal(cosineSimilarity([NaN, 1], [1, 0]), 0);
});

test('weak matches are excluded and selected sources retain policy identity', () => {
  const rows = [
    { text: 'Unrelated', embedding: [0, 1], policyId: 'p2', title: 'Security' },
    { text: '12 annual leave days', embedding: [1, 0], policyId: 'p1', title: 'Leave' },
  ];
  const selected = selectSources([1, 0], rows, { threshold: 0.3 });
  assert.equal(selected.length, 1);
  assert.equal(selected[0].policyId, 'p1');
});
