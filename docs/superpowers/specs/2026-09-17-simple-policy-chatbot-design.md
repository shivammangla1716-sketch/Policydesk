# Simple Policy Chatbot Design

## Goal

PolicyDesk will be a small RAG project with two clear users: an administrator who manages policy documents and a public visitor who asks questions about those documents.

## Product flow

The public home page requires no account. A visitor selects an existing company, sees the titles of its ready policies, and asks questions in a chatbot. Answers use only the selected company's indexed policy chunks and display the policy sources used.

The admin area has sign up and sign in. Creating an account creates one company and makes that account its administrator. After authentication, the admin sees only the policy library and can add, replace, inspect, retry, or delete policies. The admin can return to the public chatbot and sign out.

## Removed scope

- Employee accounts and customer accounts
- Invitations, members, and the People page
- Admin chatbot and saved admin conversations
- Settings and analytics pages
- Suggested-question cards, follow-up suggestion buttons, feedback controls, decorative sidebars, motivational copy, and verbose empty states

## API boundaries

Public endpoints list companies, return the ready policy titles for one company, and answer a question for one company. The public answer request accepts a short recent message history so follow-up questions work without storing personal chat history.

Authenticated admin endpoints retain policy management. Authentication endpoints only create or sign in administrators. Public endpoints never return full policy text or embeddings.

## Interface

The public screen contains a compact header, company selector, visible policy names, message list, and message input. The admin auth screen uses a two-column layout whose left side contains only “Less searching. More knowing.” The admin dashboard contains a single policy list with one primary “Add policy” action.

## Validation

API tests cover anonymous public discovery and RAG answers, company isolation, administrator-only policy mutations, and removal of invitation/member behavior. Frontend helpers are tested where they contain logic. The complete test suite, lint, and production build must pass.
