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
| UT-02 | Unit | BR-10–BR-12, AC-03 | Every Action transition pair; completion needs Result | `server/tests/lab-04/action-lifecycle.test.ts` | Planned |
| UT-03 | Unit | BR-19–BR-25, AC-06 | Every Ticket transition and resolution predicate | `server/tests/lab-04/ticket-workflow.test.ts` | Planned |
| UT-04 | Unit | BR-26–BR-32, AC-07–AC-08 | Metric status groups, limits, ordering, drill-down mapping | `server/tests/lab-04/dashboard-rules.test.ts` | Planned |
| DB-01 | Integration | FR-12, BR-37–BR-38, AC-09 | Fresh migration and populated Lab 3 migration preserve data | `server/tests/lab-04/migration.test.ts` | Pass locally — Issue #53 populated upgrade and guarded recovery |
| DB-02 | Integration | BR-38, AC-09 | Seed twice; stable identities/counts and 0/1/many Actions | `server/tests/lab-04/migration.test.ts` | Pass locally — Issue #53 repeated seed preserves reviewed records |
| DB-03 | Integration | BR-14–BR-16, AC-03–AC-04 | Atomic projection/event write; stale revision loses | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| API-01 | API | FR-01–FR-03, AC-01–AC-03 | Create/list/edit Action with correct Ticket, actor, assignee, time | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| API-02 | API | BR-05–BR-08, AC-02 | Field boundaries, protected fields, follow-up rule, inactive/bad assignee | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| API-03 | API | BR-10–BR-14, AC-03 | Assign/transition/complete/cancel/reopen and immutable event history | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| API-04 | Security | BR-33–BR-36, AC-05 | Requester own/cross-owner read; all requester writes denied; notes absent | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| API-05 | API | BR-16, AC-04 | Concurrent edits with same revision; one winner, one `STALE_ACTION` | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| API-06 | API | BR-17, AC-01/AC-10 | lost-response retry with same request ID creates one Action/event | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| API-07 | API | BR-08–BR-09, AC-02 | assign racing deactivate/demote preserves eligible-assignee invariant | `server/tests/lab-04/actions-taken.api.test.ts; server/tests/lab-03/users-admin.api.test.ts` | Planned |
| API-08 | API | FR-07–FR-08, AC-06 | all Ticket transitions; gate accepted/rejected; advisory never resolves | `server/tests/lab-04/ticket-workflow.api.test.ts` | Planned |
| API-09 | API | BR-23, AC-04/AC-06 | stale Ticket update loses without partial workflow change | `server/tests/lab-04/ticket-workflow.api.test.ts` | Planned |
| API-10 | API/Security | FR-09, AC-07 | Requester counts/lists isolated across users and ordered/bounded | `server/tests/lab-04/requester-dashboard.api.test.ts` | Planned |
| API-11 | API | BR-27/BR-30–BR-32, AC-07 | zero/non-zero counts, UTC values, drill-down query equivalence | `server/tests/lab-04/requester-dashboard.api.test.ts` | Planned |
| API-12 | API/Security | FR-10–FR-11, AC-08 | staff/admin allowed; requester forbidden; current-user Action scope | `server/tests/lab-04/staff-dashboard.api.test.ts` | Planned |
| API-13 | API | BR-28–BR-32, AC-08 | status/priority/urgent/recent counts match direct DB queries | `server/tests/lab-04/staff-dashboard.api.test.ts` | Planned |
| API-14 | Failure | FR-13, BR-35–BR-36, AC-10 | safe 500/requestId; no private/internal detail; retry safe | all four required API files | Planned |
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
| AC-03 | UT-02, DB-03, API-03, UI-03, E2E-01 |
| AC-04 | DB-03, API-05, API-09, UI-03–UI-04, E2E-01–E2E-02 |
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

Additional unit/migration/performance files in the matrix are allowed. Final paths must replace planned paths if implementation structure changes.

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

Lab 4 E2E scripts will be added before E2E rows can pass. Playwright Chromium and an isolated PostgreSQL test target are prerequisites. Final evidence records command, SHA, timestamp/timezone, counts, result, and CI link. “Planned” is not evidence of passing.

## 6. Migration and Recovery Procedure

Test clean deploy, populated Lab 3 forward migration, repeated seed, and application startup. Snapshot fixture counts/IDs/ownership before migration and compare afterward. Exercise the documented recovery path on a disposable database. Never use `prisma migrate reset` against development or production data.

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
