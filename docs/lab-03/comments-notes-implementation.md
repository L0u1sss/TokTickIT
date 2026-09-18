# Issue #34: Public Comments and Internal Notes

Implemented on `feat/lab3-comments-and-notes`, following Lab_3_sheet.pdf sections 4.4–4.6 and the existing engineering contract (BR-23, BR-25–28; AC-12–14).

- Requester owners, IT Staff and Administrators can read/post Public Comments through their role-specific routes. Foreign Requester Tickets return safe 404 responses.
- Internal Notes use staff-only GET/POST routes. Requesters receive 403 before Ticket/note lookup. Neither Requester responses nor staff detail responses embed notes; the staff UI loads them separately.
- Both entry types are append-only through the API. Author is taken from the session and creation time from the database. Extra request fields, blank content, NUL and more than 2,000 trimmed Unicode code points are rejected. The 2,000-code-point limit matches the existing Ticket description budget, keeping discussion entries readable and bounded while allowing Thai and emoji. React renders plain text, preserving line breaks and wrapping long content.
- Separate green Public Comment and amber Internal Note forms explain their audience. Forms show counts, pending/empty/success/error states and retain drafts on failed submissions.
- `POST /api/tickets/:id/problem-appears-resolved` records an actor/time pair without changing status. Replays return the same indication; Resolved/Closed/Cancelled reject it. Reopened clears both fields. A serializable transaction prevents concurrent updates from silently overwriting workflow state; conflicts return a safe 409 and may be retried.

## Migration and local use

`20260919010000_resolution_indication` adds nullable actor/time columns, a restrictive User foreign key and a check requiring both fields to be present or absent together. Existing Tickets and Attachments are preserved. Apply with `npx prisma migrate deploy` from `server`, then run `npx prisma generate` before starting the updated server. Local validation applied migrations only to disposable test schemas, not the development database.

## Verification

- Server: `npm run build`, `npm run lint`, `npm run test:isolated` — 269/269 tests passed, including populated migration regression.
- Client: `npm run build`, `npm run lint`, `npm test` — 96/96 tests passed.
- Live browser: `node scripts/run-auth-e2e.mjs --communications` from `client` — 1/1 passed against an isolated PostgreSQL schema. Covers Staff posting public/private entries, Requester visibility and direct API denial, Requester reply, confirmation/indication persistence and Staff seeing the indication.
- Screenshots: `artifacts/lab-03/screenshots/comments-notes/`, Staff and Requester at 1440, 834 and 390 pixels. Browser checks no horizontal overflow at all three sizes. Mobile images inspected for distinct audiences, wrapped text and usable controls.

New test files: `server/tests/lab-03/content-validation.test.ts`, `server/tests/lab-03/comments-notes.api.test.ts`, `client/tests/lab-03/TicketCommunication.test.tsx`, `client/e2e/lab-03/comments-notes.spec.ts`.

These are local issue-level results. Peer approval, hosted CI, merge and whole-sprint Definition of Done remain separate release evidence.
