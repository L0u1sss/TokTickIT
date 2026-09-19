# Issue #36 — Requester regression

Scope: [issue #36](https://github.com/L0u1sss/TokTickIT/issues/36), Lab 3 handout
sections 5.2, 8.2 and 10, and the existing Lab 3 engineering contract.
Branch: `test/lab3-requester-regression`.

## Plan recorded before implementation

- Preserve the existing authenticated Lab 2 lifecycle, ownership, idempotency,
  recovery, accessibility and responsive suites.
- Add a focused real-database API regression suite for the combined Requester
  lifecycle and a table of direct staff/admin API denials. Supply valid Origin
  and CSRF headers so denials establish role authorization.
- Add a live browser flow covering removal of legacy identity controls/state,
  create/list/detail, attachments, public comments, resolution indication,
  foreign ownership and direct staff/admin screen denial.
- Extend the populated Lab 2 migration check to prove migrated credentials can
  authenticate, require first-password change, and access preserved data afterward.
- Run server/client tests, live browser regression, lint and builds. Record local
  evidence separately from hosted CI, peer review and final-main completion.

## Traceability

| Requirement | Coverage |
|---|---|
| FR-05, AC-06: session identity; create/list/detail/attachments | `server/tests/lab-03/requester-regression.api.test.ts`, existing Lab 2 suites, `client/e2e/lab-03/requester-regression.spec.ts` |
| FR-03, AC-05: role/ownership boundaries | Focused API denial matrix and browser foreign-ticket/staff/admin denial |
| FR-11, AC-12: Public Comments | Focused lifecycle plus `server/tests/lab-03/comments-notes.api.test.ts` |
| FR-06, AC-14: Problem Appears Resolved | Focused lifecycle plus existing status/idempotency matrix |
| FR-17, AC-07: populated migration continuity | `server/tests/lab-03/migration.test.ts` |

## Verification

Local working-tree verification on 2026-09-20, based on `6ad9640`:

| Command from repository root | Result |
|---|---|
| `npm --prefix server run test:isolated` | 31 files, 300 tests passed |
| `npm --prefix client test -- --maxWorkers=2` | 17 files, 105 tests passed |
| `npm --prefix client run test:e2e` | 7 live browser flows passed (new regression plus six Lab 2 flows) |
| `npm --prefix client run test:responsive` | 6 browser tests passed |
| Server/client `npm run lint` and `npm run build` | Passed |

The focused API file contributes 17 tests: one complete ownership lifecycle and
16 staff/admin method/path denials with valid Origin and CSRF. The migration
suite now authenticates the preserved active Requester, verifies mandatory
password change, then reads the original Ticket and removed Attachment metadata;
the migrated inactive account cannot log in. Existing migration checks still
verify IDs, timestamps, audit fields, priority backfill and restrictive FKs.

Database suites and live browser tests use newly allocated disposable schemas
under `TEST_DATABASE_URL`; development data is not reset. The new browser flow
runs through the existing `test:e2e` command and therefore the existing CI step.
It covers persisted comments/indication, unchanged New status, foreign Ticket
and Attachment denial, forbidden Staff/Admin screens, legacy state cleanup and
logout revocation. Existing browser coverage retains attachment removal,
idempotency, failure recovery and keyboard operation.

The existing product behavior passed these regressions; no application or schema
change was needed. The initial local API failure was caused by an outdated
generated Prisma client and disappeared after `npx prisma generate`. Test
development also corrected the not-found locator to target the actual alert and
checked the migrated Ticket FK before login creates Session references.

Responsive checks use mocked API fixtures at 1440×900, 834×1112 and 390×844.
Refreshed Ticket Detail viewport captures under
`docs/lab-03/evidence/requester-regression/` were visually inspected: header,
identity, navigation and visible content wrap without overlap. These are viewport
captures, not full-page evidence for below-fold collaboration controls; the live
flow separately exercises those controls. No new 200% zoom evidence is claimed.

The handout was consulted through its existing adjacent `Lab_3_sheet.txt`
extraction, together with the repository specification/API/UI contract.
Hosted CI for these changes, peer approval, and final-main integration remain
pending; these local results do not establish completion of the full Lab 3 product.
