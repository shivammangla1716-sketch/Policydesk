# PolicyDesk

PolicyDesk is a simple RAG-based policy chatbot.

An admin creates a company account and uploads policy documents. Public users choose a company, see its available policy names, and ask questions without creating an account. The chatbot answers only from that company's uploaded policies and shows the policy names used as sources.

## Run locally

Add these values to `server/.env`:

```ini
GEMINI_API_KEY=your_key
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=a_random_secret_with_at_least_32_characters
PORT=5001
CLIENT_ORIGIN=http://127.0.0.1:5173
```

Then run:

```bash
npm run dev
```

Open `http://127.0.0.1:5173`.

## What the project contains

- Admin signup and login
- $10 payment-flow preview before admin signup
- PDF, DOCX, TXT, and pasted-text policy uploads
- Policy processing, replacement, retry, viewing, and deletion
- Public company selection and policy-name list
- Public chatbot with no customer login
- Company-scoped retrieval so policies never mix between companies
- Gemini embeddings, grounded answers, and source names
- Automated API and retrieval tests

## How RAG works here

1. The admin uploads a policy.
2. The backend extracts and splits its text into chunks.
3. Gemini converts every chunk into an embedding.
4. A public user selects a company and asks a question.
5. The question is converted into an embedding.
6. The backend searches only that company's policy chunks.
7. Gemini writes an answer using the matching chunks.
8. If the policies do not contain the answer, the chatbot says it could not find enough information.

## Main API routes

```text
GET  /api/public/companies
GET  /api/public/companies/:id
POST /api/public/ask

POST /api/auth/signup
POST /api/auth/login
POST /api/auth/logout

GET    /api/policies
POST   /api/policies
GET    /api/policies/:id
POST   /api/policies/:id/replace
POST   /api/policies/:id/retry
DELETE /api/policies/:id
```

Policy management routes require an authenticated admin session. Public routes return policy names and grounded answers; they never return full policy documents or embeddings.

## Useful commands

```bash
npm run dev
npm test
npm run lint
npm run build
```

## Production deployment

The production site runs on an EC2 instance behind Nginx at
`https://3-105-28-84.sslip.io`. Docker binds the Node.js service only to
`127.0.0.1:5001`; ports 80 and 443 are served by Nginx.

Every successful `Verify PolicyDesk` run on `main` triggers the deployment
workflow on the production self-hosted runner. The workflow builds a revision-
tagged image, starts it with the server's protected environment file, checks
`/api/health`, and restores the previous image if the health check fails.

The runner must have the `policydesk-production` label and run as a user with
Docker access. The protected environment file remains on the server at
`/home/ubuntu/policydesk/server/.env`; it is never stored in Git or a Docker
image.

## Project structure

```text
src/                    React public chat and admin interface
server/routes/          Public, authentication, and policy APIs
server/services/        Document extraction, embeddings, retrieval, and answers
server/models/          Company, admin, policy, and chunk models
server/tests/           API and RAG tests
```
