# Issue #37: test evidence

## Plan recorded before implementation (2026-09-20)

Source: [issue #37](https://github.com/L0u1sss/TokTickIT/issues/37) and
`D:\Software_Engineering\Lab_3_sheet.pdf`, sections 10, 12 and 14.
Branch: `test/lab3-e2e-responsive-accessibility`.

Reuse the existing authentication, authorization, queue, communication, administrator,
Requester regression and populated-migration suites. Add the missing required
`server/tests/lab-03/staff-ticket-detail.api.test.ts`,
`client/tests/lab-03/StaffTicketDetail.test.tsx` and
`client/e2e/lab-03/staff-ticket-flow.spec.ts`. Browser tests live below `client/e2e`
because Playwright and its runners belong to the client package.

| Planned coverage | Requirement / AC | Evidence |
|---|---|---|
| Staff detail, safe DTO, attachments, missing/forbidden resources | API-15, API-30; AC-05, AC-19 | New staff detail API suite |
| Claim and competing claims, eligible/ineligible reassignment | API-16–17; AC-09–10 | New staff detail API suite |
| Independent IT Priority, all status pairs, terminal ownership | API-18–19; AC-10–11 | New staff detail API suite and existing status unit suite |
| Staff detail loading, operations, confirmation, conflicts, safe failures | UI-06; AC-17 | New StaffTicketDetail component suite |
| Live claim/reassign/priority/status/comment/note workflow | E2E-02; AC-09–14 | New staff-ticket-flow browser suite |
| Login/forced change, queue, detail and admin at desktop/tablet/mobile/reflow | AC-18 | Browser screenshots, keyboard and layout assertions |
| Valid/invalid/inactive login, logout and direct API authorization | AC-01–05 | Authentication API/component/browser suites |
| Admin create/edit/reset, duplicate email, self-deactivation, last admin | AC-15–16 | Existing admin API/component/browser suites |
| Migration and Requester Ticket/Attachment continuity | AC-06–07 | Existing migration and Requester regression suites |

Run tests against disposable PostgreSQL schemas using existing isolation guards.
Record failures before associated fixes; do not invent historical TDD evidence.
Run full server/client suites, all browser runners, lint and builds. Preserve complete
command output, map final results to actual test paths, and distinguish local results
from hosted CI, review and final-main evidence. Automated accessibility checks have
limited scope and do not substitute for a manual accessibility audit.

## Results

Local verification completed on 2026-09-20 from branch
`test/lab3-e2e-responsive-accessibility`, after integrating `origin/lab3-staging`
at `96eee02` (the merged PR #47 base). These results are for the current
working tree and are not hosted CI or final-main evidence.

| Evidence | Command / location | Actual result |
|---|---|---|
| Focused staff detail API | `server` `npx vitest run --project database tests/lab-03/staff-ticket-detail.api.test.ts` | 75/75 passed |
| Focused staff detail UI | `client` `npx vitest run tests/lab-03/StaffTicketDetail.test.tsx` | 9/9 passed |
| Full server suite | `npm --prefix server run test:isolated` | 377/377 passed across 32 files |
| Full client suite | `npm --prefix client test` | 114/114 passed across 18 files |
| Requester browser regression | `npm --prefix client run test:e2e` | 6/6 passed |
| Staff browser workflow | `npm --prefix client run test:staff:e2e` | 1/1 passed |
| Administrator browser workflow | `npm --prefix client run test:admin:e2e` | 1/1 passed |
| Authentication browser workflow | `npm --prefix client run test:auth:e2e` | 1/1 passed |
| Responsive browser checks | `npm --prefix client run test:responsive` | 6/6 passed |
| Lint and builds | client/server `run lint`, `run build` | Passed |
| Diff hygiene | `git diff --check` | Passed |

All database-backed browser and server runs used disposable PostgreSQL test
schemas. The local worktree still contains uncommitted implementation,
evidence, and screenshot changes; hosted CI, final commit SHA, peer review, and
approval remain pending.
