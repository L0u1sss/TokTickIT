# Issue #31 — Requester identity migration and authorization

## Scope and base

Local branch: `feat/lab3-user-migration`, based on authentication commit `6d39f49` from #30. That dependency was fast-forwarded locally; this does not claim #30 is merged or peer-approved. No GitHub write or push was performed.

Reference: Lab 3 labsheet sections 4.3, 4.4 and 5; Issue [#31](https://github.com/L0u1sss/TokTickIT/issues/31); specification BR-11–BR-14, BR-35, BR-38 and AC-03–AC-07.

## Migration and initial credentials

`20260916010000_migrate_requester_identity` runs in one transaction with locks on the affected tables. It copies every Requester into `User`, preserving IDs, display names, activation state and timestamps; canonicalizes email; assigns exactly `REQUESTER`; sets `mustChangePassword=true`; moves the existing Ticket requester and Attachment uploader/remover foreign keys to `User`; then removes the obsolete `RequesterUser` table. Ticket/Attachment row contents and files are not rewritten or discarded. User sequence is advanced above the greatest existing ID.

ID/email collisions with #30 Users, or duplicate canonical emails, abort the transaction rather than merge unrelated identities or lose history. Resolve collisions with an explicitly reviewed data plan before retrying. Do not reset a populated development database to bypass this failure. Prisma may record a failed migration even when its transaction rolls back; investigate and resolve that migration record only after confirming rollback and fixing the cause.

**Local educational database only:** migrated accounts use the documented initial password `Lab3-Initial-password1!`, stored as an Argon2id hash. The SQL migration uses one precomputed salted hash for that shared local fixture password; it is not a production credential-delivery design. Do not deploy this migration/seed against real-user or internet-facing databases. Login cannot grant Ticket access until the initial password is changed; inactive migrated users cannot log in. Subsequent password changes use freshly salted hashes.

`prisma db seed` creates 4 active + 1 inactive Requesters, 3 active + 1 inactive IT Staff, and 1 active Administrator. Seed password is the same local-only initial value above. Rerunning seed never resets existing password, role, activation or forced-change state. `auth:provision` remains available for a new local account with a random initial password printed once; it never replaces an existing account.

## Authorization and UI

- Login is public. `/api/auth/me`, password change and Logout use the #30 session rules. Health is public.
- All other `/api` paths require a live active-user session and completed password change; role and activation are read from the database on every request.
- `/api/tickets/*` and `/api/metadata` require `REQUESTER`. Actor identity is derived only from the session. Legacy `x-requester-id` is ignored; protected body fields such as `requesterId` are rejected by the existing strict contract. Unknown query fields remain invalid.
- `/api/staff/*` permits IT Staff and Administrator; `/api/admin/*` permits Administrator only. These guards precede future feature handlers and return 403 to forbidden roles; permitted requests to unimplemented operations return 404, not fake data.
- Origin checking applies to unsafe requests before JSON/multipart parsing. CORS permits the configured `CLIENT_ORIGIN` with credentials. Protected responses are not cached. Role failures return 403; foreign and missing Ticket resources return 404 `NOT_FOUND` under the Lab 3 non-disclosure contract (superseding Lab 2 foreign-owner 403). Errors include a correlation `requestId`; safe 500 logging uses that ID. Validation adds `fieldErrors` while retaining legacy `details` for existing Ticket form clients.
- The selector endpoint/component and mutable browser requester state are removed. The old sessionStorage key is discarded. Ticket components retain a read-only `useRequester` adapter supplied by `useAuth`, not a second source of identity.
- Root/direct routes enter Login or mandatory Change Password as required. Requesters enter Create Ticket/My Tickets and retain valid direct Ticket URLs. IT Staff/Administrator see role-specific navigation; their feature screens are clearly marked planned, with no operational actions yet.
- Logout unmounts Ticket content; pending requests are aborted and late results cannot update a new session. Browser back/reload revalidates authentication.

## Local run

Back up any populated local database before schema migration. From repository root, configure server `.env` (`DATABASE_URL`, a separate `TEST_DATABASE_URL`, `NODE_ENV=development`, and `CLIENT_ORIGIN=http://localhost:5173`) and client `.env` (`VITE_API_URL=http://localhost:3000`).

```powershell
npm.cmd --prefix server ci
npm.cmd --prefix client ci
Set-Location server
npx.cmd prisma generate
npx.cmd prisma migrate deploy
npx.cmd prisma db seed
npm.cmd run dev
```

In another terminal at repository root: `npm.cmd --prefix client run dev`. Open `http://localhost:5173/login`. Example Requester: `jennifer.a@example.com`; staff: `staff.one@example.com`; Administrator: `admin@example.com`. Use the initial password above only for a newly seeded/migrated account; existing changed passwords stay unchanged.

## Verification and remaining scope

Run `npm.cmd --prefix server run test:isolated` for an automatically allocated disposable schema, all migrations, seed, full suites and cleanup. Client commands: `test`, `run test:auth:e2e`, `run test:e2e`, `run test:responsive`, `run lint`, `run build`. Server also has `run lint` and `run build`. Full results are recorded in [tests.md](tests.md).

The Lab 2 selector/context tests were replaced with session-gate, cookie transport, role navigation, logout and stale-request assertions. Ticket validation, idempotency, search/filter/pagination, attachment lifecycle and keyboard/responsive regression tests remain active, now using authenticated sessions. This intentionally changes test counts; old Lab 2 results are historical, not the current suite total.

Ticket workflow/status/IT Priority/owner fields, comments/notes, full staff/admin operations and workflow fixtures remain subsequent feature issues. Passing #31 does not complete all Lab 3 DB-01–DB-06 or final responsive evidence for screens that do not yet exist. Hosted CI/final SHA and peer approval remain pending until the user commits/pushes and review occurs.
