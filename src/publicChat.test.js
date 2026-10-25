import { test } from 'node:test'
import assert from 'node:assert/strict'
import { screenForPath, toApiHistory } from './publicChat.js'

test('admin URL opens admin access and other URLs open the public chatbot', () => {
  assert.equal(screenForPath('/admin'), 'admin')
  assert.equal(screenForPath('/admin/'), 'admin')
  assert.equal(screenForPath('/'), 'public')
})

test('public chat sends only the latest eight valid message texts', () => {
  const messages = Array.from({ length: 10 }, (_, index) => ({
    role: index % 2 ? 'assistant' : 'user',
    text: `message ${index + 1}`,
    sources: [{ title: 'Private UI detail' }],
  }))
  assert.deepEqual(toApiHistory(messages), Array.from({ length: 8 }, (_, index) => ({
    role: (index + 2) % 2 ? 'assistant' : 'user',
    text: `message ${index + 3}`,
  })))
});

test('public chat omits incomplete local messages from API history', () => {
  assert.deepEqual(toApiHistory([
    { role: 'user', text: 'Leave?' },
    { role: 'assistant', text: '' },
    { role: 'system', text: 'hidden' },
  ]), [{ role: 'user', text: 'Leave?' }])
});
