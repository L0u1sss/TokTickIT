# TokTickIT Lab 4 — Test-Driven Development and Traceability Plan

> Status: Planned. No row may be marked Pass until executed against the recorded commit.
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
| DB-01 | Integration | FR-12, BR-37–BR-38, AC-09 | Fresh migration and populated Lab 3 migration preserve data | `server/tests/lab-04/migration.test.ts` | Planned |
| DB-02 | Integration | BR-38, AC-09 | Seed twice; stable identities/counts and 0/1/many Actions | `server/tests/lab-04/migration.test.ts` | Planned |
| DB-03 | Integration | BR-14–BR-16, BR-40–BR-41, AC-03–AC-04 | Atomic projection/event/parent-version write; stale Action or Ticket version loses | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| API-01 | API | FR-01–FR-03, AC-01–AC-03 | Create/list/edit Action with correct Ticket, recorder, assignee, performedBy, time, and returned parent version | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| API-02 | API | BR-05–BR-08, AC-02 | Field boundaries, protected fields, follow-up rule, inactive/bad assignee | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| API-03 | API | BR-02, BR-10–BR-14, BR-42, AC-03 | Assign/transition/complete/cancel; only current assignee can complete; performedBy equals assignee; reject terminal reversal/edit and non-actionable parent; enforce follow-up rule and immutable event history | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| API-04 | Security | BR-33–BR-36, AC-05 | Requester own/cross-owner read; all requester writes denied; notes absent | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| API-05 | API | BR-16, BR-40–BR-41, AC-04 | Concurrent edits with same parent/Action versions; one winner, stale loser, one event and one parent version increment; success returns the next parent token | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| API-06 | API | BR-17, AC-01/AC-10 | lost-response retry with same request ID creates one Action/event | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| API-07 | API | BR-08–BR-09, AC-02 | assign racing deactivate/demote preserves eligible-assignee invariant | `server/tests/lab-04/actions-taken.api.test.ts; server/tests/lab-03/users-admin.api.test.ts` | Planned |
| API-08 | API | FR-07–FR-08, AC-06 | all Ticket transitions; current-cycle gate rejects active/follow-up Actions; advisory never resolves | `server/tests/lab-04/ticket-workflow.api.test.ts` | Planned |
| API-09 | API | BR-23, BR-40–BR-41, AC-04/AC-06 | stale integer Ticket version on status transition loses; conditional update has no partial workflow change | `server/tests/lab-04/ticket-workflow.api.test.ts` | Planned |
| API-15 | API | BR-23, BR-40–BR-41, AC-04 | Claim, owner assignment/reassignment, and priority writes require expectedTicketVersion; stale concurrent requests return STALE_TICKET and accepted requests increment version exactly once and return the next token | `server/tests/lab-04/ticket-mutations.api.test.ts` | Planned |
| API-10 | API/Security | FR-09, AC-07 | Requester counts/lists isolated across users and ordered/bounded; exact seven-day resolved window | `server/tests/lab-04/requester-dashboard.api.test.ts` | Planned |
| API-11 | API | BR-27/BR-30–BR-32, AC-07 | inclusive lower/exclusive upper UTC bounds, returned drill-down bounds, statusIn validation | `server/tests/lab-04/requester-dashboard.api.test.ts` | Planned |
| API-12 | API/Security | FR-10–FR-11, AC-08 | staff/admin allowed; requester forbidden; recorder/assignee/performer union and attribution | `server/tests/lab-04/staff-dashboard.api.test.ts` | Planned |
| API-13 | API | BR-28–BR-32, AC-08 | status/priority/urgent/recent counts match direct DB queries; current-user Actions deduplicated | `server/tests/lab-04/staff-dashboard.api.test.ts` | Planned |
| API-14 | Failure | FR-13, BR-35–BR-36, AC-10 | safe 500/requestId; no private/internal detail; retry safe | all four required API files | Planned |
| RACE-01 | Concurrent API | BR-21, BR-40–BR-42, AC-04/AC-06 | Action create/update/complete versus Ticket resolve/cancel; shared parent lock yields serial outcome and gate recheck; terminal Ticket rejects later Action writes | `server/tests/lab-04/ticket-resolution-concurrency.api.test.ts` | Planned |
| RACE-02 | Concurrent API | BR-40–BR-41, AC-04 | Competing claim/owner/priority writes with one expected version serialize; stale loser cannot overwrite winner | `server/tests/lab-04/ticket-mutations.api.test.ts` | Planned |
| UI-01 | Component | FR-10, AC-08 | cards/lists/loading/zero/error/drill-down/current-user Actions | `client/tests/lab-04/StaffDashboard.test.tsx` | Planned |
| UI-02 | Component | FR-09, AC-07 | own metrics/recent lists/zero/error/drill-down | `client/tests/lab-04/RequesterDashboard.test.tsx` | Planned |
| UI-03 | Component | FR-01–FR-06, AC-01–AC-05/AC-10 | list/create/edit/assign/lifecycle/validation/read-only/conflict/draft retention | `client/tests/lab-04/ActionsTaken.test.tsx` | Planned |
| UI-04 | Component | FR-07–FR-08, AC-04/AC-06 | permitted status controls, confirmation, gate/stale feedback, refresh | `client/tests/lab-04/TicketWorkflow.test.tsx` | Planned |
| STYLE-01 | UI style | FR-15, AC-12 | Zen Green tokens, non-color cues, long-text wrapping | Lab 4 component tests | Planned |
| PERF-01 | Smoke | FR-11, AC-07–AC-08 | dashboard endpoints p95 ≤500 ms for 1,000 Tickets/5,000 Actions locally after warm-up | `server/tests/lab-04/dashboard-performance.test.ts` | Planned |
| RV-01 | Browser | FR-15, AC-12 | both dashboards at 1440×900, 834×1112, 390×844 | `client/e2e/lab-04/dashboards.spec.ts` | Planned |
| RV-02 | Browser | FR-15, AC-12 | Actions create/edit/read-only at three viewports; no page overflow | `client/e2e/lab-04/actions-taken-flow.spec.ts` | Planned |
| A11Y-01 | Browser/manual | FR-15, AC-12 | axe + landmarks/names/live regions; keyboard/focus/dialog/200% reflow | all Lab 4 E2E specs + checklist | Planned |
| E2E-01 | Live E2E | AC-01–AC-05/AC-10 | staff creates/assigns/edits/completes; requester reads; retry/conflict | `client/e2e/lab-04/actions-taken-flow.spec.ts` | Planned |
| E2E-02 | Live E2E | AC-04/AC-06 | Action completion → resolve → close; advisory/reopen/cancel cases | `client/e2e/lab-04/ticket-resolution.spec.ts` | Planned |
| E2E-03 | Live E2E | AC-07–AC-08 | role dashboards, database count evidence, drill-down, zero state | `client/e2e/lab-04/dashboards.spec.ts` | Planned |
| REG-01 | Regression | AC-11 | login/change/logout and role/direct-route authorization | existing Lab 3 auth suites | Planned |
| REG-02 | Regression | AC-11 | Create/My Tickets/Detail/Attachments/ownership/idempotency | existing Lab 2 + requester regression suites | Planned |
| REG-03 | Regression | AC-11 | staff queue/owner/priority/status/comments/notes/download | existing Lab 3 staff suites | Planned |
| REG-04 | Regression | AC-11 | user create/edit/deactivate/role/initial password/admin safety | existing Lab 3 admin suites | Planned |

## 3. Acceptance-Criteria Traceability

| Criterion | Planned evidence |
|---|---|
| AC-01 | API-01, API-06, UI-03, E2E-01 |
| AC-02 | UT-01, API-02, API-07, UI-03 |
| AC-03 | UT-02, DB-03, API-01, API-03, UI-03, E2E-01 |
| AC-04 | DB-03, API-05, API-09, API-15, RACE-02, UI-03–UI-04, E2E-01–E2E-02 |
| AC-05 | API-04, UI-03, E2E-01 |
| AC-06 | UT-03, API-08–API-09, UI-04, E2E-02 |
| AC-07 | UT-04, API-10–API-11, UI-02, E2E-03 |
| AC-08 | UT-04, API-12–API-13, UI-01, E2E-03 |
| AC-09 | DB-01–DB-02 |
| AC-10 | API-06, API-14, UI-03, E2E-01 |
| AC-11 | REG-01–REG-04 plus full server/client suites |
| AC-12 | STYLE-01, RV-01–RV-02, A11Y-01 |
| AC-13 | final CI/review/screenshots/report audit in release issue |

Every AC has planned automated or explicit manual evidence. Manual evidence never replaces an automatable authorization or business-rule check.

## 4. Required Locations

```text
server/tests/lab-04/
├── actions-taken.api.test.ts
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

These are planned target paths, not files present in the contract baseline. At this commit `server/tests/lab-04/`, `client/tests/lab-04/`, and `client/e2e/lab-04/` do not exist; the implementation issues must add them or update this matrix to the actual paths before claiming coverage. Existing Lab 1–3 suites remain at their current locations. Additional unit/migration/performance files are allowed.

## 5. Planned Verification Commands

```powershell
npm --prefix server run test:unit
npm --prefix server run test:isolated
npm --prefix server run lint
npm --prefix server run build
npm --prefix client run test
npm --prefix client run lint
npm --prefix client run build
```

The listed server/client package scripts were verified in `server/package.json` and `client/package.json`: `test:unit`, `test:isolated`, `test:db`, `lint`, and `build` exist for the server; `test`, `test:e2e`, `test:responsive`, `lint`, and `build` exist for the client. The target Lab 4 spec files/directories above are planned and absent at this contract commit; the existing client `test:e2e` runner does not prove those future specs exist. Run from the repository root, for example `npm --prefix server run test:unit`, `npm --prefix server run test:isolated`, `npm --prefix client run test`, and `npm --prefix client run test:e2e`. Playwright Chromium and an isolated PostgreSQL test target are prerequisites. Final evidence records command, SHA, timestamp/timezone, counts, result, and CI link. “Planned” is not evidence of passing.

## 6. Migration and Recovery Procedure

Test clean deploy, populated Lab 3 forward migration, repeated seed, and application startup. Snapshot fixture counts/IDs/ownership before migration and compare afterward. Destructive rollback/drop is allowed only against an isolated disposable migration-test database after verifying no user data or real Actions exist. For any populated development/staging/production database, recovery is verified backup/restore or a forward corrective migration only. Never use `prisma migrate reset` against development or production data.

## 7. Final Evidence Template

| Date/time (Asia/Bangkok) | Commit SHA | Environment | Command/CI link | Result/counts | Notes |
|---|---|---|---|---|---|
| TBD | TBD | TBD | TBD | Not run | Populate only after execution |
