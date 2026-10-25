import { test } from 'node:test'
import assert from 'node:assert/strict'
import { changeAdminStep } from './adminSignupFlow.js'

test('new admin must pass through payment before signup', () => {
  assert.equal(changeAdminStep('login', 'create-account'), 'payment')
  assert.equal(changeAdminStep('payment', 'payment-success'), 'signup')
})

test('back returns the admin flow to login', () => {
  assert.equal(changeAdminStep('payment', 'back'), 'login')
  assert.equal(changeAdminStep('signup', 'back'), 'login')
})
