import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { createApp } from '../app.js';
import { createTestAI } from '../services/ai.js';
import { processNextPolicy } from '../services/ingestion.js';
import User from '../models/User.js';

let db, app, alice, bob, aliceSession, bobSession;
const config = { jwtSecret: 'test-secret-with-at-least-32-characters', production: false, clientOrigin: 'http://localhost:5173', rateLimits: false };
const ai = createTestAI();

before(async () => {
  db = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(db.getUri());
  app = createApp({ config, ai, logger: { info() {}, error() {} } });
  alice = request.agent(app); bob = request.agent(app);
  aliceSession = (await alice.post('/api/auth/signup').send({ name: 'Alice', email: 'alice@example.com', password: 'Securepass123!', companyName: 'Aster Labs' }).expect(201)).body;
  bobSession = (await bob.post('/api/auth/signup').send({ name: 'Bob', email: 'bob@example.com', password: 'Securepass123!', companyName: 'Birch Labs' }).expect(201)).body;
});

after(async () => { await mongoose.disconnect(); await db?.stop(); });

test('signup always creates a company administrator', async () => {
  await request(app).post('/api/auth/signup').send({ name: 'Mallory', email: 'mallory@example.com', password: 'Securepass123!' }).expect(400);
  assert.equal(aliceSession.user.role, 'admin');
  assert.notEqual(aliceSession.company.id, bobSession.company.id);
  assert.equal((await alice.get('/api/auth/me').expect(200)).body.user.email, 'alice@example.com');
});

test('health response contains only the production service status', async () => {
  assert.deepEqual((await request(app).get('/api/health').expect(200)).body, { status: 'ok' });
});

test('public visitors can discover companies and see only ready policy names', async () => {
  const ready = (await alice.post('/api/policies').field('title', 'Annual leave').field('category', 'Benefits').field('content', 'Annual leave\n\nEmployees receive 24 days of paid annual leave every calendar year. Request leave in the HR portal at least five working days in advance.').expect(202)).body.policy;
  await alice.post('/api/policies').field('title', 'Still processing').field('content', 'This policy is waiting to be indexed and must not appear publicly.').expect(202);
  await processNextPolicy(ai);

  const companies = (await request(app).get('/api/public/companies').expect(200)).body.companies;
  assert.ok(companies.some(company => company.id === aliceSession.company.id && company.name === 'Aster Labs'));
  const company = (await request(app).get(`/api/public/companies/${aliceSession.company.id}`).expect(200)).body.company;
  assert.deepEqual(company.policies.map(policy => policy.title), ['Annual leave']);
  assert.equal(JSON.stringify(company).includes('content'), false);
  assert.equal(JSON.stringify(company).includes('embedding'), false);
  assert.equal(company.policies[0].id, ready.id);
});

test('public answers use only the selected company and return cited policy names', async () => {
  const answer = (await request(app).post('/api/public/ask').send({
    companyId: aliceSession.company.id,
    question: 'How many annual leave days do employees receive?',
    history: [{ role: 'user', text: 'Tell me about leave.' }],
  }).expect(200)).body.message;
  assert.match(answer.text, /24/);
  assert.equal(answer.sources.length, 1);
  assert.equal(answer.sources[0].title, 'Annual leave');

  const otherCompany = (await request(app).post('/api/public/ask').send({ companyId: bobSession.company.id, question: 'How many annual leave days?' }).expect(200)).body.message;
  assert.equal(otherCompany.sources.length, 0);
  assert.doesNotMatch(otherCompany.text, /24/);
});

test('policy management remains private and scoped to its administrator', async () => {
  const policies = (await alice.get('/api/policies').expect(200)).body.policies;
  const annualLeave = policies.find(policy => policy.title === 'Annual leave');
  await request(app).get('/api/policies').expect(401);
  await request(app).delete(`/api/policies/${annualLeave.id}`).expect(401);
  await bob.get(`/api/policies/${annualLeave.id}`).expect(404);
  await bob.delete(`/api/policies/${annualLeave.id}`).expect(404);
  await bob.post(`/api/policies/${annualLeave.id}/replace`).field('content', 'Overwritten').expect(404);

  await alice.post(`/api/policies/${annualLeave.id}/replace`).field('content', 'Annual leave\n\nEmployees receive 30 paid leave days every calendar year.').expect(202);
  await processNextPolicy(ai);
  assert.equal((await alice.get(`/api/policies/${annualLeave.id}`).expect(200)).body.policy.version, 2);
  await alice.delete(`/api/policies/${annualLeave.id}`).expect(200);
  await alice.get(`/api/policies/${annualLeave.id}`).expect(404);
});

test('removed workspace, invitation, member, and conversation APIs do not exist', async () => {
  await request(app).get('/api/invitations/not-a-token').expect(404);
  await alice.post('/api/invitations').send({ email: 'employee@example.com' }).expect(404);
  await alice.get('/api/members').expect(404);
  await alice.get('/api/workspace').expect(404);
  await alice.get('/api/conversations').expect(404);
  await alice.post('/api/ask').send({ question: 'Leave?' }).expect(404);
});

test('public answer validation and provider failures return safe errors', async () => {
  await request(app).post('/api/public/ask').send({ companyId: aliceSession.company.id, question: '' }).expect(400);
  await request(app).post('/api/public/ask').send({ companyId: aliceSession.company.id, question: { $ne: null } }).expect(400);
  await request(app).get('/api/public/companies/not-an-id').expect(400);

  await bob.post('/api/policies').field('title', 'Remote work').field('content', 'Employees may work remotely two days each week.').expect(202);
  while (await processNextPolicy(ai)) { /* Make the provider call observable. */ }
  const failing = createApp({ config, ai: { ...ai, embed: async () => { throw new Error('Provider unavailable'); } }, logger: { info() {}, error() {} } });
  await request(failing).post('/api/public/ask').send({ companyId: bobSession.company.id, question: 'Remote work days?' }).expect(502);
});

test('unsupported policy documents fail before processing', async () => {
  await alice.post('/api/policies').field('title', 'Empty').field('content', '   ').expect(400);
  await alice.post('/api/policies').field('title', 'Executable').attach('file', Buffer.from('bad'), 'unsafe.exe').expect(400);
});

test('cross-origin browser mutations are rejected and both loopback origins work locally', async () => {
  await alice.post('/api/policies').set('Origin', 'https://evil.example').field('title', 'Blocked').field('content', 'This request must never be accepted.').expect(403);
  await request(app).post('/api/auth/logout').set('Origin', 'http://127.0.0.1:5173').expect(200);
});

test('logout invalidates sessions', async () => {
  const login = await request(app).post('/api/auth/login').send({ email: 'bob@example.com', password: 'Securepass123!' }).expect(200);
  const originalCookie = login.headers['set-cookie'][0].split(';', 1)[0];
  await request(app).post('/api/auth/logout').set('Cookie', originalCookie).expect(200);
  await request(app).get('/api/auth/me').set('Cookie', originalCookie).expect(401);
  const expired = jwt.sign({ userId: bobSession.user.id, version: 0 }, config.jwtSecret, { algorithm: 'HS256', expiresIn: -1, issuer: 'policydesk' });
  const expiredLogout = await request(app).post('/api/auth/logout').set('Cookie', `session=${expired}`).expect(200);
  assert.match(expiredLogout.headers['set-cookie'][0], /^session=;/);
});

test('logout reports a database revocation failure', async () => {
  const login = await request(app).post('/api/auth/login').send({ email: 'alice@example.com', password: 'Securepass123!' }).expect(200);
  const cookie = login.headers['set-cookie'][0].split(';', 1)[0];
  const updateOne = User.updateOne;
  User.updateOne = async () => { throw new Error('Database unavailable'); };
  try { await request(app).post('/api/auth/logout').set('Cookie', cookie).expect(500); }
  finally { User.updateOne = updateOne; }
  await request(app).get('/api/auth/me').set('Cookie', cookie).expect(200);
});
