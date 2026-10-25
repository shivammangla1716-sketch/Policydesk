import { test } from 'node:test'
import assert from 'node:assert/strict'
import { api } from './api.js'

test('failed API requests expose an actionable server error', async () => {
  const original = globalThis.fetch
  globalThis.fetch = async () => new Response(JSON.stringify({ error: 'Choose a valid company.' }), { status: 400 })
  try { await assert.rejects(api('/public/companies/bad-id'), /Choose a valid company/) }
  finally { globalThis.fetch = original }
})

test('JSON requests send session credentials and return parsed data', async () => {
  const original = globalThis.fetch
  globalThis.fetch = async (url, options) => {
    assert.equal(url, '/api/public/ask')
    assert.equal(options.credentials, 'include')
    assert.deepEqual(JSON.parse(options.body), { question: 'Leave?' })
    return new Response(JSON.stringify({ message: { text: 'Twenty days.' } }))
  }
  try { assert.equal((await api('/public/ask', { method: 'POST', body: { question: 'Leave?' } })).message.text, 'Twenty days.') }
  finally { globalThis.fetch = original }
})
