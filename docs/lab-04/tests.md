# TokTickIT Lab 4 — Test-Driven Development and Traceability Plan

> Status: In progress. Local evidence applies only to the recorded commit or explicitly identified worktree; it does not establish final `main`, CI, peer approval, or unperformed manual checks.
>
> Contract baseline: Issue #52, `specification.md`, `api-spec.md`, and `ui-spec.md`.

## 1. Strategy

Tests are written before or alongside implementation. Unit tests cover deterministic rules; API/integration tests cover database invariants, authorization, migration, concurrency, and failures; component tests cover UI behavior; Playwright covers live workflows, responsive layouts, accessibility, and regression. Database tests must use an isolated `TEST_DATABASE_URL`, never development data.

## 2. Planned Test Matrix

| ID | Type | Requirement / AC | Scenario and expected result | Planned automated file | Final |
|---|---|---|---|---|---|
| UT-01 | Unit | BR-05–BR-06, AC-02 | Unicode boundaries, trim, conditional follow-up note | `server/tests/lab-04/action-validation.test.ts` | Planned |
| UT-02 | Unit | BR-10–BR-13, AC-03 | Every Action transition pair; terminal reversal/edit rejected; completion needs Result and cleared follow-up | `server/tests/lab-04/action-lifecycle.test.ts` | Planned |
| UT-03 | Unit | BR-19–BR-25, AC-06 | Every Ticket transition; current-cycle resolution predicate; cycle/resolvedAt updates | `server/tests/lab-04/ticket-workflow.test.ts` | Planned |
| UT-04 | Unit | BR-26–BR-32, AC-07–AC-08 | Seven-day window boundaries, status groups, limits, ordering, query mapping, attribution/deduplication | `server/tests/lab-04/dashboard-rules.test.ts` | Planned |
| DB-01 | Integration | FR-12, BR-37–BR-38, AC-09 | Fresh migration and populated Lab 3 migration preserve data; legacy Tickets get version/cycle 1 and null resolvedAt, with zero fabricated Actions | `server/tests/lab-04/migration.test.ts` | Pass (local) |
| DB-02 | Integration | BR-02–BR-04, BR-14–BR-16, BR-38, AC-03/AC-09 | Seed twice; stable identities/counts and 0/1/many Actions; distinct attribution; lifecycle-aligned events; staff/cascade cancellation; append-only and changedFields database guards; ordering and Action constraints | `server/tests/lab-04/migration.test.ts` | Pass (local review follow-up) |
| DB-03 | Integration | BR-14–BR-16, BR-40–BR-41, AC-03–AC-04 | API transaction appends one event at the incremented Action revision; projection/event revisions remain contiguous and atomic; stale Action or Ticket version loses. Database itself enforces event revision positivity/uniqueness only. | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| API-01 | API | FR-01–FR-03, AC-01–AC-03 | Create/list/edit Action with correct Ticket, recorder, assignee, performedBy, time, and returned parent version | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| API-02 | API | BR-05–BR-08, AC-02 | Field boundaries, protected fields, follow-up rule, inactive/bad assignee | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| API-03 | API | BR-02, BR-10–BR-14, BR-42, AC-03 | Assign/transition/complete/cancel; only current assignee can complete; performedBy equals assignee; verify completion/cancellation provenance fields and immutable terminal history; reject terminal reversal/edit and non-actionable parent | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| API-04 | Security | BR-33–BR-36, AC-05 | Requester own/cross-owner read; all requester writes denied; notes absent | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| API-05 | API | BR-16, BR-40–BR-41, AC-04 | Concurrent edits with same parent/Action versions; one winner, stale loser, one event and one parent version increment; success returns the next parent token | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| API-06 | API | BR-17, AC-01/AC-10 | lost-response retry with same request ID creates one Action/event | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| API-07 | API | BR-08–BR-09, AC-02 | assign racing deactivate/demote preserves eligible-assignee invariant | `server/tests/lab-04/actions-taken.api.test.ts; server/tests/lab-03/users-admin.api.test.ts` | Planned |
| API-08 | API | FR-07–FR-08, AC-06 | all Ticket transitions; current-cycle gate rejects active/follow-up Actions; advisory never resolves | `server/tests/lab-04/ticket-workflow.api.test.ts` | Pass locally - PR #66, 2026-10-03 |
| API-09 | API | BR-23, BR-40–BR-41, AC-04/AC-06 | stale integer Ticket version on status transition loses; conditional update has no partial workflow change | `server/tests/lab-04/ticket-workflow.api.test.ts` | Pass locally - PR #66, 2026-10-03 |
| API-15 | API | BR-23, BR-40–BR-41, AC-04 | Claim, owner assignment/reassignment, and priority writes require expectedTicketVersion; stale concurrent requests return STALE_TICKET and accepted requests increment version exactly once and return the next token | `server/tests/lab-04/ticket-mutations.api.test.ts` | Planned |
| API-16 | API/Integration | BR-12, BR-14, BR-41, BR-43, AC-03/AC-06 | Ticket cancellation increments each current-cycle active Action revision once, sets updatedAt/cancelledAt/cancelledBy/source, appends TICKET_CASCADE_CANCELLED event with authenticated actor, preserves follow-up as historical, and makes old Action revisions stale | `server/tests/lab-04/ticket-workflow.api.test.ts` | Pass locally - PR #66, 2026-10-03 |
| API-10 | API/Security | FR-09, AC-07 | Requester counts/lists isolated across users and ordered/bounded; exact seven-day resolved window | `server/tests/lab-04/requester-dashboard.api.test.ts` | Pass locally - PR #67; see validation below |
| API-11 | API | BR-27/BR-30–BR-32, BR-43, AC-07 | inclusive lower/exclusive upper UTC bounds, returned drill-down bounds, statusIn validation, recentlyUpdated reflects accepted aggregate mutations through Ticket.updatedAt | `server/tests/lab-04/requester-dashboard.api.test.ts` | Pass locally - PR #67; see validation below |
| API-12 | API/Security | FR-10–FR-11, AC-08 | staff/admin allowed; requester forbidden; recorder/assignee/performer union and attribution | `server/tests/lab-04/staff-dashboard.api.test.ts` | Planned |
| API-13 | API | BR-28–BR-32, BR-43, AC-08 | status/priority/urgent/recent counts match direct DB queries; current-user Actions deduplicated; accepted Action/aggregate writes update Ticket.updatedAt and Recently Updated ordering | `server/tests/lab-04/staff-dashboard.api.test.ts` | Planned |
| API-14 | Failure | FR-13, BR-35–BR-36, AC-10 | safe 500/requestId; no private/internal detail; retry safe | all four required API files | Planned |
| RACE-01 | Concurrent API | BR-21, BR-40–BR-42, AC-04/AC-06 | Action create/update/complete versus Ticket resolve/cancel; shared parent lock yields serial outcome and gate recheck; terminal Ticket rejects later Action writes | `server/tests/lab-04/ticket-resolution-concurrency.api.test.ts` | Planned |
| RACE-02 | Concurrent API | BR-40–BR-41, AC-04 | Competing claim/owner/priority writes with one expected version serialize; stale loser cannot overwrite winner | `server/tests/lab-04/ticket-mutations.api.test.ts` | Planned |
| RACE-03 | Concurrent API | BR-02, BR-04, BR-16, BR-40, AC-03–AC-04 | Reassign versus current-assignee completion: reassignment-first rejects old assignee completion; completion-first leaves terminal Action and rejects reassignment | `server/tests/lab-04/actions-concurrency.api.test.ts` | Planned |
| UI-01 | Component | FR-10, AC-08 | cards/lists/loading/zero/error/drill-down/current-user Actions | `client/tests/lab-04/StaffDashboard.test.tsx` | Planned |
| UI-02 | Component | FR-09, AC-07 | own metrics/recent lists/zero/error/drill-down | `client/tests/lab-04/RequesterDashboard.test.tsx` | Pass locally - PR #67; see validation below |
| UI-03 | Component | FR-01–FR-06, BR-02/BR-04/BR-11–BR-18/BR-40–BR-42, AC-01–AC-05/AC-10 | stable ordering; null performer and recorder attribution; create/edit/assign/terminal lifecycle; assignee-only completion; required Result/cleared follow-up; conditional note, corrected-field errors and focus recovery; current Ticket/Action tokens; inactive-assignee feedback; stale/uncertain response recovery; retained drafts/request ID; protected failures | `client/tests/lab-04/ActionsTaken.test.tsx` | Pass locally — 20 tests, Issue #55 |
| UI-05 | Component integration | BR-23/BR-40–BR-42, AC-04/AC-10/AC-11 | Action success supplies the next Ticket-operation version; same-Ticket refresh preserves drafts; Ticket/Action writes cannot overlap; stale/uncertain operations block further writes until recovery; denied reload clears protected detail | `client/tests/lab-03/StaffTicketDetail.test.tsx` | Pass locally — Detail/Queue suite: 25 tests, Issue #55 |
| UI-04 | Component | FR-07–FR-08, AC-04/AC-06 | permitted status controls, confirmation, gate/stale feedback, refresh | `client/tests/lab-04/TicketWorkflow.test.tsx` | Pass locally - PR #66, 2026-10-03 |
| STYLE-01 | UI style | FR-15, AC-12 | Zen Green tokens, non-color cues, long-text wrapping | Lab 4 component tests | Planned |
| PERF-01 | Smoke | FR-11, AC-07–AC-08 | dashboard endpoints p95 ≤500 ms for 1,000 Tickets/5,000 Actions locally after warm-up | `server/tests/lab-04/dashboard-performance.test.ts` | Planned |
| RV-01 | Browser | FR-15, AC-12 | both dashboards at 1440×900, 834×1112, 390×844 | `client/e2e/lab-04/dashboards.spec.ts` | Requester pass locally - PR #67; staff pending |
| RV-02 | Browser | FR-15, AC-12 | real-API Actions create/edit/list/terminal/read-only at 1440×900, 834×1112, 390×844; long descriptions/attachment references wrap; no page overflow; mobile controls have 44×44 targets | `client/e2e/lab-04/actions-taken-flow.spec.ts` | Pass locally — 3 viewport flows, 25 total screenshots, Issue #55 |
| A11Y-02 | Browser/component | FR-15, AC-12 | Actions accessible labels/live regions/error links; keyboard create/submit/Escape, first-invalid-field and terminal-transition focus; no serious/critical axe violations in captured Action states | `client/tests/lab-04/ActionsTaken.test.tsx; client/e2e/lab-04/actions-taken-flow.spec.ts` | Pass locally — automated Action checks, Issue #55 |
| A11Y-01 | Browser/manual | FR-15, AC-12 | axe + landmarks/names/live regions; keyboard/focus/dialog/200% reflow | all Lab 4 E2E specs + checklist | Planned |
| E2E-01 | Live E2E | AC-01–AC-05/AC-10 | authenticated staff/admin list/create/assign/edit/start/complete/cancel; real assignee-only completion denial; real inactive-assignee rejection/recovery; Ticket-cascade history; requester read-only/owned data; stale draft reload/reapply; lost-response replay with one stored Action; actual server versions/revisions | `client/e2e/lab-04/actions-taken-flow.spec.ts` | Pass locally — 7 tests, Issue #55 |
| E2E-02 | Live E2E | AC-04/AC-06 | Action completion → resolve → close; advisory/reopen/cancel cases | `client/e2e/lab-04/ticket-resolution.spec.ts` | Pass locally - PR #66, 2026-10-03 |
| E2E-03 | Live E2E | AC-07–AC-08 | role dashboards, database count evidence, drill-down, zero state | `client/e2e/lab-04/dashboards.spec.ts` | Requester pass locally - PR #67; staff pending |
| REG-01 | Regression | AC-11 | login/change/logout and role/direct-route authorization | existing Lab 3 auth suites | Planned |
| REG-02 | Regression | AC-11 | Create/My Tickets/Detail/Attachments/ownership/idempotency | existing Lab 2 + requester regression suites | Planned |
| REG-03 | Regression | AC-11 | staff queue/owner/priority/status/comments/notes/download | existing Lab 3 staff suites | Planned |
| REG-04 | Regression | AC-11 | user create/edit/deactivate/role/initial password/admin safety | existing Lab 3 admin suites | Planned |

## 3. Acceptance-Criteria Traceability

| Criterion | Planned evidence |
|---|---|
| AC-01 | API-01, API-06, UI-03, E2E-01 |
| AC-02 | UT-01, API-02, API-07, UI-03, E2E-01 |
| AC-03 | UT-02, DB-03, API-01, API-03, RACE-03, UI-03, E2E-01 |
| AC-04 | DB-03, API-05, API-09, API-15, RACE-02–RACE-03, UI-03–UI-05, E2E-01–E2E-02 |
| AC-05 | API-04, UI-03, E2E-01 |
| AC-06 | UT-03, API-08–API-09, API-16, UI-04, E2E-02 |
| AC-07 | UT-04, API-10–API-11, UI-02, E2E-03 |
| AC-08 | UT-04, API-12–API-13, UI-01, E2E-03 |
| AC-09 | DB-01–DB-02 |
| AC-10 | API-06, API-14, UI-03, UI-05, E2E-01 |
| AC-11 | REG-01–REG-04 plus full server/client suites |
| AC-12 | STYLE-01, RV-01–RV-02, A11Y-01–A11Y-02 |
| AC-13 | final CI/review/screenshots/report audit in release issue |

Every AC has planned automated or explicit manual evidence. Manual evidence never replaces an automatable authorization or business-rule check.

## 4. Required Locations

```text
server/tests/lab-04/
├── actions-taken.api.test.ts
├── actions-concurrency.api.test.ts
├── ticket-mutations.api.test.ts
├── ticket-workflow.api.test.ts
├── requester-dashboard.api.test.ts
└── staff-dashboard.api.test.ts

client/tests/lab-04/
├── StaffDashboard.test.tsx
├── RequesterDashboard.test.tsx
├── ActionsTaken.test.tsx
└── TicketWorkflow.test.tsx

client/e2e/lab-04/
├── actions-taken-flow.spec.ts
├── ticket-resolution.spec.ts
└── dashboards.spec.ts
```

This tree contains both existing and planned target paths. The current increment includes `server/tests/lab-04/ticket-workflow.api.test.ts`, `client/tests/lab-04/TicketWorkflow.test.tsx`, `client/e2e/lab-04/ticket-resolution.spec.ts`, `server/tests/lab-04/actions-taken.api.test.ts`, `server/tests/lab-04/migration.test.ts`, `client/tests/lab-04/ActionsTaken.test.tsx`, and `client/e2e/lab-04/actions-taken-flow.spec.ts`. Dashboard and additional standalone concurrency target files remain planned unless separately implemented and verified. Workflow matrix/current-cycle gate and status versus Action/owner/priority races are verified in `ticket-workflow.api.test.ts`. The staff integration checks remain in `client/tests/lab-03/StaffTicketDetail.test.tsx`. Existing Lab 1–3 suites retain their current locations; additional unit/migration/performance files are allowed.

## 5. Planned Verification Commands

```powershell
npm --prefix server run test:unit
npm --prefix server run test:isolated
npm --prefix server run lint
npm --prefix server run build
npm --prefix client run test
npm --prefix client run lint
npm --prefix client run build
npm --prefix client run test:actions:e2e
```

The listed server/client package scripts are defined in `server/package.json` and `client/package.json`: `test:unit`, `test:isolated`, `test:db`, `lint`, and `build` exist for the server; `test`, `test:e2e`, `test:workflow:e2e`, `test:actions:e2e`, `test:responsive`, `lint`, and `build` exist for the client. Run from the repository root using `npm --prefix <directory> run <script>`. `test:actions:e2e` uses `client/scripts/run-auth-e2e.mjs --actions-taken` to run the real Action flow against authenticated fixtures in a newly allocated disposable PostgreSQL schema. The older `test:e2e` script targets its documented requester regression files and does not establish Lab 4 coverage. Playwright Chromium and a distinct, test-marked `TEST_DATABASE_URL` are prerequisites. Final evidence records command, SHA, timestamp/timezone, counts, result, and CI link. “Planned” or “Pending verification” is not evidence of passing.

## 6. Migration and Recovery Procedure

Test clean deploy, populated Lab 3 forward migration, repeated seed, and application startup. Snapshot fixture counts/IDs/ownership before migration and compare afterward. Destructive rollback/drop is allowed only against an isolated disposable migration-test database after verifying no user data or real Actions exist. For any populated development/staging/production database, recovery is verified backup/restore or a forward corrective migration only. Never use `prisma migrate reset` against development or production data.

## 7. Final Evidence Template

| Date/time (Asia/Bangkok) | Commit SHA | Environment | Command/CI link | Result/counts | Notes |
|---|---|---|---|---|---|
| TBD | TBD | TBD | TBD | Not run | Populate only after execution |

## 8. Issue #53 Local Evidence — 2026-09-25

- `npm exec prisma validate` and `npm exec prisma generate`: Pass.
- `npm run build`: Pass.
- `npm run lint`: Pass.
- `npm run test:unit`: Pass — 19 files, 165 tests.
- `npm run test:isolated -- tests/lab-04/migration.test.ts`: Pass — 1 file, 3 tests.
- `npm run test:isolated`: Pass — 33 files, 380 tests.

The migration suite uses disposable PostgreSQL schemas and verifies populated Lab 3 preservation, zero-action legacy behavior, schema constraints, audit identities, all status/priority seed coverage, assigned/unassigned Tickets, zero/one/multiple Actions, repeated-seed preservation, guarded rollback refusal after data, pre-use rollback, and forward recovery. Record the final commit SHA and hosted CI link after push/PR; local evidence is not peer approval.

## 9. PR #63 Review Follow-up — 2026-09-30

The previous agent's handoff records a clean reviewed PR head `8705b3c1244200295e1f0b3253cda1f584e112aa` passing these checks on 2026-09-30, before the review follow-up edits:

- `prisma validate`: Pass.
- `npm run build`: Pass.
- `npm run test:isolated -- tests/lab-04/migration.test.ts`: Pass — 1 file, 3 tests.
- `git diff --check`: Pass.

The current uncommitted review follow-up is based on `8705b3c1244200295e1f0b3253cda1f584e112aa`; checks independently rerun on this worktree on 2026-09-30 at 04:32–04:33 Asia/Bangkok passed:

- `prisma validate` and `prisma generate`: Pass.
- `npm run build`: Pass.
- `npm run lint`: Pass.
- `npm run test:isolated -- tests/lab-04/migration.test.ts`: Pass — 1 file, 3 tests.
- `git diff --check`: Pass.

The migration suite covers append-only triggers, changedFields shape, deterministic event timestamps, and Ticket-cascade cancellation. These uncommitted worktree results are not checks on commit `8705b3c`; rerun on the final commit and record hosted CI/peer-review evidence against the final pushed commit before merge.

Prisma generation initially encountered a Windows query-engine DLL lock while the migration suite was running. After the suite exited, generation, build, and lint passed sequentially.

### Pending PR description correction

Updating PR #63 through the GitHub connector returned HTTP 403 (`Resource not accessible by integration`). The remote description remains unchanged. Replace its ordering bullet with:

> Ticket Action ordering ตาม `createdAt ASC`, `id ASC`; `workflowCycle` ใช้กรอง current-cycle query ไม่ใช่ sort key ของรายการรวมทุก cycle

## 10. Issue #55 Contract Alignment and Local Evidence — 2026-10-02

The follow-up starts from merge commit `c00bb1a0c71d22c7cafc2bb932fc37bb014791b2`; the implementation and evidence below describe the current worktree until a final commit is recorded. Earlier UI tests used the older API shape and do not prove compatibility with the merged Action contract.

### Handout traceability

| Source in `SE+Lab+4.pdf` | Issue #55 evidence |
|---|---|
| §7, pp. 4–5 | Existing Zen Green controls/cards and text status cues; keyboard focus, wrapping, and responsive Action screenshots |
| §8.3, p. 6 | Stable list; create/view/edit; shared requester read-only; created time, description, Result, automatic performer, follow-up flag/conditional note, Attachment Notes |
| §§8.5–8.6, p. 7 | Loading/empty/validation/success/forbidden/not-found/conflict/safe-failure recovery; repeated-submit/idempotent retry; retained drafts; inherited responsive/accessibility rules |
| §12, pp. 9–10 | Actual component/E2E files listed above and `artifacts/lab-04/screenshots/actions-taken/` |
| Answer Part 6, p. 11 | Multiple Actions on one Ticket; create/assign/edit/start/complete/cancel; eligibility feedback, roles, failures, and responsive behavior |

The handout leaves the detailed lifecycle and concurrency choices to the engineering contract. This increment follows the current contract: `performedBy=null` until the current assignee completes; terminal Actions remain immutable; parent terminal/resolved Tickets are read-only; completion and staff cancellation require cleared follow-up; cancellation provenance and historical follow-up are visible; writes use `expectedTicketVersion` and Action `revision`, then accept the returned `{ action, ticketVersion }` token. Requester Action rendering stays separate from staff-only Internal Notes.

### Verification record

| Command / evidence | Result | Scope |
|---|---|---|
| `npm --prefix client run test -- tests/lab-04/ActionsTaken.test.tsx` | Pass — 20 tests | Action component; included in the final full-suite output below |
| `npm --prefix client run test -- tests/lab-03/StaffTicketDetail.test.tsx tests/lab-03/StaffTicketQueue.test.tsx` | Pass — 25 tests | Staff Detail/Queue integration and regression; included in the final full suite |
| `npm --prefix client run test` | Pass — 19 files, 141 tests; 16.43 s | [Final local client output](../../artifacts/lab-04/test-output/client-tests.txt) |
| `npm --prefix client run lint` | Pass | [Final lint/build output](../../artifacts/lab-04/test-output/client-build-lint.txt); latest source, including focus and corrected-field-error changes |
| `npm --prefix client run build` | Pass | [Final lint/build output](../../artifacts/lab-04/test-output/client-build-lint.txt); latest TypeScript/Vite build |
| `npm --prefix client run test:actions:e2e` | Pass — 7 tests; 57.8 s | [Final real-API browser output](../../artifacts/lab-04/test-output/actions-taken-e2e.txt); three viewports, 25 screenshots, axe, ownership, eligibility, concurrency and idempotent replay |

The final browser flow demonstrates actual eligibility enforcement: an authenticated Administrator deactivates an unassigned staff user while another browser retains that user in its cached selector. Creation receives `409 INVALID_ACTION_ASSIGNEE`, keeps the draft, reloads eligible choices, and succeeds once with an active assignee. The stale-edit case performs a real concurrent server update, then retains/reloads/reapplies the local draft using both current tokens. The lost-response case lets the real server commit creation before aborting the browser response, then replays the same request ID and verifies one stored Action.

The browser flow resolves a Ticket after completed work to check that the Action area becomes read-only. It does not test backend rejection of a failed Ticket resolution gate; that remains Issue #56 and the planned API-08/UI-04/E2E-02 scope. Action completion/cancellation Result, follow-up, and assignee rules are exercised here.

The [25 screenshots](../../artifacts/lab-04/screenshots/actions-taken/) include validation, create, planned list, edit, terminal list, resolved parent, and requester read-only at all three viewports; desktop captures additionally show cancellation history, inactive-assignee feedback, a stale draft, and safe-save recovery. Representative visual inspection covered the [desktop planned list](../../artifacts/lab-04/screenshots/actions-taken/planned-list/desktop.png), [tablet terminal list](../../artifacts/lab-04/screenshots/actions-taken/terminal-list/tablet.png), and [mobile create form](../../artifacts/lab-04/screenshots/actions-taken/create-form/mobile.png), with no observed page overflow or clipped controls. This limited inspection does not complete the full product visual checklist.

The [CI workflow](../../.github/workflows/ci.yml) includes `lab4-staging` triggers, the Action E2E command, and an evidence upload step. Hosted evidence recorded after the original local run is listed below. Full Lab 4 dashboards/standalone workflow suites, complete manual keyboard/200% reflow checks, peer approval, final release review, and final `main` evidence remain separate deliverables; the local results above apply to the explicitly identified Issue #55 worktree.

## 11. PR #65 review alignment — 2026-10-03

The required PR description correction follows the implemented lifecycle: `PLANNED → IN_PROGRESS | CANCELLED`, `IN_PROGRESS → COMPLETED | CANCELLED`; `COMPLETED` and `CANCELLED` are immutable. There is no Reopen/Restore Action control. Continued work requires a new Action. The evidence counts are 20 Action component tests, 19 client files / 141 tests, and 7 real-API Action browser tests; the original local artifacts retain their original worktree attribution. Updating the remote PR description through the connector returned HTTP 403 (`Resource not accessible by integration`); the prepared replacement remains pending publication.

Hosted [CI run #69](https://github.com/L0u1sss/TokTickIT/actions/runs/36941288267), associated with reviewed head `8beb2de01e81bb0d9dd8af1e83f3beaeca220567`, completed successfully. Its [job](https://github.com/L0u1sss/TokTickIT/actions/runs/36941288267/job/110633116302) passed server/client tests, Actions E2E, authentication/admin/staff/comments/responsive/requester browser regressions, lint, builds, and evidence uploads. This verifies that head only; the documentation follow-up needs its own hosted run and is not claimed green in advance.

CI workflow, README, fixture updates, reference-only seeding (`SEED_REFERENCE_DATA_ONLY`), and fresh tickets for staff retries are test/evidence plumbing required by Issue #55. They run and publish evidence, document isolated setup, preserve initially empty requester lists, and align staff regression with the reload/version contract. Default development seeding still includes Lab 4 demo Tickets and Actions.

<a id="pr66-validation"></a>

## 11. PR #66 Contract Alignment - 2026-10-03

Scope: local `feat/lab4-ticket-workflow`, original PR head `ed1fe71`, integrating staging dependency `7102116`. `lab4-staging` is unchanged at `7102116`. Incoming conflict resolutions are preserved in backup refs/stash before implementation alignment. These are worktree results, not hosted CI, peer approval, final-main evidence, or completion of the separate dashboard issues.

The handout sections 4.5, 5.2, 6.1, 8.4, 8.5, 9-10 and Answer Part 7 are implemented through the existing BR-19-BR-25/BR-40-BR-43 contract. The original PR's timestamp-only status write and minimum-only gate have been upgraded together with the client to required integer `expectedTicketVersion`, the shared parent lock, and current-cycle resolution checks. Reopening retains history and starts a new cycle; cancellation retains follow-up history and atomically records actor/time/source, Action revisions/events and one parent version increment. Requester indication remains advisory.

Verified local results:

- Server `npm run build` and `npm run lint`: Pass.
- Server `npm run test:isolated`: Pass - 35 files, 473 tests; workflow suite includes 76 API cases.
- Client `npm run build` and `npm run lint`: Pass.
- Client `npm test`: Pass - 20 files, 147 tests; workflow component suite includes 6 tests.
- Client `npm run test:workflow:e2e`: Pass - 3 tests at desktop 1440x900, tablet 834x1112 and mobile 390x844.
- Client `npm run test:staff:e2e`: Pass - 1 existing Lab 3 live staff regression test.
- Client `npm run test:actions:e2e`: Pass - 7 existing Lab 4 Actions Taken live regression tests.

The API suite exhausts all 64 Ticket transition pairs; checks staff/admin role and protected-field validation; rejects zero-Action, historical-cycle and active/follow-up work; checks resolvedAt/cycle and terminal ownership/advisory cleanup; verifies stale/concurrent status, owner, priority and Action-create races; checks cancellation provenance and preserved audit history; and prevents private exception disclosure. Component tests verify permitted options, confirmations, version payload, gate/stale feedback, updated-state reload and explicit network retry. Live browser tests cover failed gate, Action create/start/complete, resolve/close/reopen, new-cycle gate rejection, cancellation of pending follow-up work, preserved history, and Requester advisory/read-only visibility.

All 18 browser screenshots include overflow assertions and axe WCAG checks with zero serious/critical findings. Browser evidence preserves pre-axe focus so automated focus probes do not change the captured UI. This does not establish complete manual keyboard or 200% reflow review. Evidence: [workflow screenshots](../../artifacts/lab-04/screenshots/ticket-workflow/), [browser console output](../../artifacts/lab-04/test-output/pr66-workflow-e2e.txt), and [local check record](../../artifacts/lab-04/test-output/pr66-validation.txt). Earlier browser attempts failed on an incorrect test checkbox selector; the selector was corrected and the complete three-viewport flow then passed. Existing Lab 3 and Issue #55 screenshots are retained; screenshots regenerated by their regression runs are backed up outside the repository rather than replacing the earlier dated evidence.

| State | Desktop | Tablet | Mobile |
|---|---|---|---|
| resolution-gate | [Screenshot](../../artifacts/lab-04/screenshots/ticket-workflow/resolution-gate/desktop.png) | [Screenshot](../../artifacts/lab-04/screenshots/ticket-workflow/resolution-gate/tablet.png) | [Screenshot](../../artifacts/lab-04/screenshots/ticket-workflow/resolution-gate/mobile.png) |
| resolved | [Screenshot](../../artifacts/lab-04/screenshots/ticket-workflow/resolved/desktop.png) | [Screenshot](../../artifacts/lab-04/screenshots/ticket-workflow/resolved/tablet.png) | [Screenshot](../../artifacts/lab-04/screenshots/ticket-workflow/resolved/mobile.png) |
| closed | [Screenshot](../../artifacts/lab-04/screenshots/ticket-workflow/closed/desktop.png) | [Screenshot](../../artifacts/lab-04/screenshots/ticket-workflow/closed/tablet.png) | [Screenshot](../../artifacts/lab-04/screenshots/ticket-workflow/closed/mobile.png) |
| reopened | [Screenshot](../../artifacts/lab-04/screenshots/ticket-workflow/reopened/desktop.png) | [Screenshot](../../artifacts/lab-04/screenshots/ticket-workflow/reopened/tablet.png) | [Screenshot](../../artifacts/lab-04/screenshots/ticket-workflow/reopened/mobile.png) |
| cancelled | [Screenshot](../../artifacts/lab-04/screenshots/ticket-workflow/cancelled/desktop.png) | [Screenshot](../../artifacts/lab-04/screenshots/ticket-workflow/cancelled/tablet.png) | [Screenshot](../../artifacts/lab-04/screenshots/ticket-workflow/cancelled/mobile.png) |
| requester-advisory | [Screenshot](../../artifacts/lab-04/screenshots/ticket-workflow/requester-advisory/desktop.png) | [Screenshot](../../artifacts/lab-04/screenshots/ticket-workflow/requester-advisory/tablet.png) | [Screenshot](../../artifacts/lab-04/screenshots/ticket-workflow/requester-advisory/mobile.png) |

## 12. PR #67 Requester dashboard contract and CI alignment - 2026-10-03

Scope: `feat/lab4-requester-dashboard`, integrating the merged PR #66 dependency `origin/lab4-staging` at `8d13e12`. No changes are published to staging/main. The original CI run #74 failed because the feature branch retained obsolete workflow fixtures and payloads; the dependency merge preserves the approved integer-version, resolution gate, and Action lifecycle instead of weakening those rules.

Coverage follows the handout sections 6.2, 7, 8.2, 8.5, 8.6 and Answer Part 8: backend-owned metrics; repeatable-read snapshot; seven-day UTC half-open resolvedAt window; stable tie ordering; five-item previews; legacy/old/future/reopened exclusion; exact window drill-down; safe failures/retry; Requester home/navigation; role denial; direct database count evidence; responsive and automated accessibility checks. Existing authentication, staff/workflow and keyboard/create browser regressions explicitly navigate from the new Dashboard home.

Actual suites: `server/tests/lab-04/requester-dashboard.api.test.ts` (6 API tests), `server/tests/lab-02/ticket-query.test.ts` (strict date/status validation), `client/tests/lab-04/RequesterDashboard.test.tsx` (5 component tests), `client/e2e/lab-04/dashboards.spec.ts` (2 real-API browser tests). Staff dashboard and whole-product performance/manual reflow/peer-release evidence remain separate work.

Final local results on this feature worktree (2026-10-03):

| Check | Result | Evidence |
|---|---|---|
| Full isolated server regression | 36 files / 480 tests passed | [Server output](../../artifacts/lab-04/test-output/pr67-server-tests.txt) |
| Full client regression | 21 files / 153 tests passed | [Client output](../../artifacts/lab-04/test-output/pr67-client-tests.txt) |
| Server and client lint/build | Passed | [Server](../../artifacts/lab-04/test-output/pr67-server-build-lint.txt), [client](../../artifacts/lab-04/test-output/pr67-client-build-lint.txt) |
| Requester dashboard real API + UI | 2 browser tests passed; 3 viewports, keyboard waiting drill-down, loading/empty/failure/retry/role denial; no serious/critical axe violations or page overflow in captured states | [Output](../../artifacts/lab-04/test-output/pr67-requester-dashboard-e2e.txt), [screenshots](../../artifacts/lab-04/screenshots/requester-dashboard/), [direct DB counts](../../artifacts/lab-04/screenshots/requester-dashboard/database-counts.json) |
| Authentication / Administrator / Queue | 1 + 1 + 1 browser tests passed | [Auth](../../artifacts/lab-04/test-output/pr67-test-auth-e2e.txt), [admin](../../artifacts/lab-04/test-output/pr67-test-admin-e2e.txt), [queue](../../artifacts/lab-04/test-output/pr67-staff-queue.txt) |
| Actions / resolution / staff / communication | 7 + 3 + 1 + 1 browser tests passed | [Actions](../../artifacts/lab-04/test-output/pr67-test-actions-e2e.txt), [resolution](../../artifacts/lab-04/test-output/pr67-test-workflow-e2e.txt), [staff](../../artifacts/lab-04/test-output/pr67-test-staff-e2e.txt), [comments](../../artifacts/lab-04/test-output/pr67-communications.txt) |
| Responsive / live requester regression | 6 + 7 browser tests passed | [Responsive](../../artifacts/lab-04/test-output/pr67-test-responsive.txt), [requester](../../artifacts/lab-04/test-output/pr67-test-e2e.txt) |
| Whitespace / conflict markers | Passed | `git diff --check`, `git diff --cached --check`; all merge conflicts resolved |

Total browser checks: 30 passing tests. Desktop and mobile dashboard screenshots were visually inspected for layout/wrapping. Hosted CI is verified separately against the pushed feature commit; these local checks do not claim final-main, peer approval, whole-product performance, or a completed manual reflow checklist.

## 13. PR #67 browser-runner regression repair - 2026-10-03

[CI run #77](https://github.com/L0u1sss/TokTickIT/actions/runs/37072283879) on `64eefa1` passed server/client tests but failed during authentication fixture setup with `requesterDashboard is not defined`. The follow-up runner edit removed the mode declaration/routing, administrator fixtures, resolvedAt timestamps, and direct database-count evidence while retaining references to the deleted variable. Client lint independently reproduced four `no-undef` errors.

Restore the complete browser runner from previously verified commit `3746ced`, including Requester dashboard mode and the fixtures required by dashboard/Actions suites. Move server/client lint immediately after dependency installation so undefined runner variables fail before browser installation, migrations and E2E. No API, UI, authorization, data contract, or existing test is weakened. Revalidate both lint commands and the authentication, Requester dashboard and Actions real-API browser suites; verify the new hosted CI against the pushed feature head.

Local follow-up results: client and server lint passed; authentication E2E 1/1, Requester dashboard E2E 2/2, and Actions E2E 7/7 passed against isolated migrated schemas. The product source is unchanged; full regression is rerun by hosted CI.
