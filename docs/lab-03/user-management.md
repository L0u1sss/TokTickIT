# Issue #35 — Administrator User Management

Implemented locally on `feat/lab3-user-management`, based on
`3c92c867e50681e6c18ef78c6f8c0a425a2a1a91` and the Lab 3 labsheet
(`D:/Software_Engineering/Lab_3_sheet.pdf`, sections 4.4, 6 and 8.5).
This is working-tree evidence, not a merged revision or peer approval.

## Behavior and contract

`/admin/users` uses the authenticated shell and supports name/email search,
one optional role filter, and Name / Email / Role / Status / Edit fields.
Desktop uses a table; below 1024 CSS pixels it uses cards. The create/edit
dialog uses the browser modal dialog, an explicit keyboard focus loop, Escape,
Cancel and focus restoration. Loading, empty/no-results, errors with Retry,
pending submissions and success messages are distinct states.

The four routes in [API specification section 6](api-spec.md#6-administrator-apis)
are implemented in `server/src/user-management.ts`. All require an active,
fully authenticated Administrator. Writes require the configured Origin and
matching CSRF cookie/header before JSON parsing. List responses initialize the
CSRF cookie. Only `UserSummary` fields are returned; hashes and sessions are
never serialized. Names are trimmed, emails trimmed/lowercased, and unknown
fields, nonboolean activation values, invalid roles and invalid passwords are
rejected. The database unique constraint resolves duplicate-email races.

Create sets an Argon2id password and `mustChangePassword=true`. Password reset
is a separate confirmation form; it replaces the hash, revokes all sessions,
and requires password change at next login. Password fields clear on cancel,
success and server failure. Role changes and deactivation also revoke target
sessions. Editing/resetting the current Administrator refreshes authentication
so the shell immediately reflects changed access.

Self-deactivation, removal of the last active Administrator, and making a
currently assigned Ticket owner inactive or a Requester return the documented
409 conflict without changing the account. Historical `lastOwnerId` does not
prevent changes. No delete, bulk, pagination, import/export, multiple-role or
email workflow was added.

## Concurrency and migration

Account creation/update/reset and Ticket claim/reassignment take transaction
advisory lock `350035` **before** reading account eligibility. Account updates
then lock actor/target User rows in ascending ID order, coordinating credential
changes with existing login/password-change locks. The Administrator count and
active assignments are rechecked inside the same transaction. Assignment now
reads eligible owners inside the transaction, after acquiring the shared lock.
These transactions use PostgreSQL's default read-committed isolation so reads
after waiting see the preceding commit. The lock is deliberately global for
this small lab system; write throughput is limited by serialized account and
assignment operations.

No schema migration or new dependency is needed. Existing User, Session and
Ticket relations are preserved. Regenerate Prisma Client when switching from
a branch with a different schema, from the `server` directory:

```powershell
node node_modules/prisma/build/index.js generate
```

## Reproducible verification

From repository root, with a separate, test-marked `TEST_DATABASE_URL` in
`server/.env`:

```powershell
npm --prefix server run test:isolated
npm --prefix client test -- --maxWorkers=4
npm --prefix client run test:admin:e2e
npm --prefix server run lint
npm --prefix server run build
npm --prefix client run lint
npm --prefix client run build
```

The isolated server and browser runners create and remove their own schemas
inside the test database. They reject the development database as a test
target. The new browser command is included in the CI workflow.

Local results:

| Check | Result and coverage |
|---|---|
| Server regression | 248/248 tests in 28 files; migration, Requester, auth, staff and Admin tests |
| Administrator API follow-up after create authorization recheck | 7/7 real PostgreSQL/Supertest tests |
| Client regression | 94/94 tests in 16 files, no unhandled errors |
| Administrator browser | 1/1 live scenario; create, search, edit, duplicate email, deactivate/reactivate, reset, forced password change, final-admin conflict and forbidden Staff access |
| Server/client lint and production builds | Passed |
| Hosted CI, merge and peer approval | Not performed |

API tests: `server/tests/lab-03/users-admin.api.test.ts` covers AC-15/16,
BR-29–32/36, all route role guards, Origin/CSRF, invalid inputs, safe summary,
session revocation, historical ownership and concurrent claim/reassign versus
deactivation and concurrent Administrator demotions.

UI tests: `client/tests/lab-03/UserManagement.test.tsx` covers AC-15/17,
list/search/reset filters, creation, duplicate-email recovery, sensitive-field
clearing, self-deactivation feedback, password confirmation, empty/retry and
forbidden states. Existing role navigation tests were updated for the live
Admin endpoint.

Browser test: `client/e2e/lab-03/user-administration.spec.ts` covers the live
account workflow and keyboard modal focus. Screenshots are in
`artifacts/lab-03/screenshots/user-management/`:

- `desktop.png` and `desktop-create.png` — 1440×900
- `tablet.png` and `tablet-create.png` — 834×1112
- `mobile.png` and `mobile-create.png` — 390×844
- `reflow-200-percent.png` and `reflow-200-percent-create.png` — 720×450 CSS viewport

The reflow check halves the desktop CSS viewport to approximate the layout at
200% zoom; it does not drive the browser's actual zoom control. Screenshots
contain disposable fictional accounts and empty password inputs. This issue's
evidence does not certify all Lab 3 screens, final-main submission, or a full
accessibility audit.
