# Simple Policy Chatbot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the workspace/invitation product with a simple public policy chatbot and an admin-only policy manager.

**Architecture:** Public routes expose company names, ready policy titles, and stateless RAG answers. Admin authentication protects the existing policy lifecycle. React renders separate public, admin-auth, and admin-policy screens.

**Tech Stack:** React 19, Vite, Express, MongoDB/Mongoose, Gemini-compatible AI service, Node test runner, Supertest

**Spec:** `docs/superpowers/specs/2026-09-17-simple-policy-chatbot-design.md`

## Global Constraints

- Public visitors do not create accounts.
- Admins only manage policies.
- Public answers are restricted to the selected company.
- Public APIs never expose policy content or embeddings.
- Remove invitation/member UI and APIs.
- Keep interface copy short and literal.

---

### Task 1: Public policy API

**Files:**
- Create: `server/routes/public.js`
- Modify: `server/app.js`
- Modify: `server/tests/api.test.js`

**Interfaces:**
- Produces: `GET /api/public/companies`, `GET /api/public/companies/:id`, `POST /api/public/ask`

- [ ] Write failing API tests proving anonymous visitors can list companies, see only ready policy titles, ask against one selected company, and cannot retrieve another company's policy data.
- [ ] Run `npm --prefix server test` and confirm the new public-route assertions fail with 404.
- [ ] Implement the three public endpoints with ObjectId validation, bounded message history, retrieval scoped by `companyId`, and source validation.
- [ ] Run `npm --prefix server test` and confirm the public-route tests pass.

### Task 2: Admin-only authentication and workspace cleanup

**Files:**
- Modify: `server/routes/auth.js`
- Modify: `server/routes/workspace.js`
- Modify: `server/services/seed.js`
- Modify: `server/app.js`
- Delete: `server/models/Invitation.js`
- Modify: `server/tests/api.test.js`

**Interfaces:**
- Consumes: existing `/api/auth/signup`, `/api/auth/login`, and authenticated `/api/policies` routes
- Produces: administrator sessions only; no invitation or member endpoints

- [ ] Replace invitation/member tests with failing tests that reject signup without a company and confirm removed endpoints return 404.
- [ ] Run the server tests and confirm the expected failures.
- [ ] Remove invitation handling and member routes and return only the policy-management APIs.
- [ ] Run the server tests and confirm authentication and policy lifecycle pass.

### Task 3: Simple public and admin interface

**Files:**
- Replace: `src/App.jsx`
- Replace: `src/Login.jsx`
- Modify: `src/Policies.jsx`
- Modify: `src/UI.jsx`
- Delete: `src/Workspace.jsx`
- Replace: `src/index.css`
- Modify: `src/api.test.js`

**Interfaces:**
- Consumes: public company endpoints, public ask endpoint, admin auth endpoints, authenticated policy endpoints
- Produces: `PublicChat`, `AdminAuth`, and `AdminDashboard` screen flows

- [ ] Update frontend API tests first to cover public JSON requests and error propagation; run `node --test src/*.test.js` and confirm the changed expectation fails.
- [ ] Build the public chatbot with company selection, ready policy title chips, local message history, source display, and no signup requirement.
- [ ] Build a short admin auth page and a one-page policy dashboard; remove chat, People, invitations, settings, sample questions, and filler copy.
- [ ] Simplify policy list copy and empty states.
- [ ] Replace styling with a clean responsive layout for the three screens.
- [ ] Run `node --test src/*.test.js`, `npm run lint`, and `npm run build`.

### Task 4: Full verification

**Files:**
- Verify all modified files

**Interfaces:**
- Consumes: complete application
- Produces: a runnable simplified project

- [ ] Run `npm test` and resolve failures.
- [ ] Run `npm run lint` and resolve errors.
- [ ] Run `npm run build` and confirm Vite produces the production bundle.
- [ ] Review the final UI copy for the prohibited filler phrases and confirm no People/invitation navigation remains.
