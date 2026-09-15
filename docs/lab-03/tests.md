# TokTickIT Lab 3 — Test Plan and Verification Evidence

> สถานะ: Planned before implementation ตาม Test DD
>
> Issue: [#29](https://github.com/L0u1sss/TokTickIT/issues/29)
>
> สถานะ `Planned` หมายถึงยังไม่มีผลทดสอบ ห้ามตีความว่า Pass

## 1. Strategy

- **Unit:** password/email/query/content/status-transition helpers
- **Database/migration:** schema constraints, populated Lab 2 preservation, idempotent seed และ concurrency invariants
- **API/integration:** auth/session, role/ownership, staff queue/operations, comments/notes, user administration และ safe errors
- **UI component/style:** screen modes, validation, focus, navigation, plain-text rendering และ Zen Green contracts
- **Responsive/accessibility:** real browserที่ desktop/tablet/mobile/200% zoom พร้อม keyboard/axe checks
- **Regression:** Lab 2 Requester Ticket/Attachment functionsหลังเปลี่ยน identity
- **E2E:** authentication, staff workflow และ Administrator workflow

Database tests ต้องใช้ isolated disposable PostgreSQL ผ่าน `TEST_DATABASE_URL` และห้ามใช้ development database schema Tests ต้อง deterministic และไม่ขึ้นกับลำดับไฟล์

## 2. Planned Test Matrix

| Test ID | Type | Requirement / AC | What it tests | Expected result | Automated test path | Status |
|---|---|---|---|---|---|---|
| UT-01 | Unit | BR-02, BR-34 | Email normalization/validation boundaries | canonical comparison; invalid rejected | `server/tests/lab-03/validation.test.ts` | Planned |
| UT-02 | Unit | BR-04, BR-06, AC-03 | Password Unicode length, classes, trim, confirmation, reuse | exact policy enforced | `server/tests/lab-03/password-policy.test.ts` | Planned |
| UT-03 | Unit | BR-20–BR-22, AC-11 | Every status transition pair | only matrix transitions allowed | `server/tests/lab-03/status-transition.test.ts` | Planned |
| UT-04 | Unit | BR-25, BR-27, BR-34 | Comment/note whitespace, Unicode boundaries, plain text | exact limits; HTML not executed | `server/tests/lab-03/content-validation.test.ts` | Planned |
| UT-05 | Unit | FR-07, AC-08 | Queue query parse/defaults/tie-breaker | strict validated query | `server/tests/lab-03/staff-queue-query.test.ts` | Planned |
| DB-01 | Integration | FR-17, AC-07 | Fresh Lab 3 migration/schema/FKs/indexes/enums | clean deploy passes | `server/tests/lab-03/migration.test.ts` | Planned |
| DB-02 | Integration | FR-17, AC-07 | Populated Lab 2 requester/ticket/attachment migration | IDs/counts/ownership preserved | `server/tests/lab-03/migration.test.ts` | Planned |
| DB-03 | Integration | BR-19, AC-07 | Ticket status/owner/IT Priority backfill | NEW preserved; owner null; IT=requested | `server/tests/lab-03/migration.test.ts` | Planned |
| DB-04 | Integration | BR-33, FR-17 | Seed run twice and role/account/ticket fixtures | exact stable fixtures; no duplicates | `server/tests/lab-03/migration.test.ts` | Planned |
| DB-05 | Integration | BR-36, AC-09, AC-16 | concurrent claim, unique email, last-admin guards | one safe winner; invariant remains | `server/tests/lab-03/concurrency.test.ts` | Planned |
| DB-06 | Integration | BR-18, BR-32, BR-36, AC-10, AC-16 | assign/reassign to X racing deactivate/demote X | one side 409; final non-null owner always eligible | `server/tests/lab-03/concurrency.test.ts` | Planned |
| API-01 | API | FR-01, AC-01 | Valid active login and safe response/cookie | 200, identity+role, secure cookie attrs | `server/tests/lab-03/auth.api.test.ts` | Planned |
| API-02 | API | BR-01–BR-03, BR-39, AC-02 | Valid request/approved Origin within rate limit: wrong password, unknown email, inactive user with correct or incorrect password; separate rate-limit case | All account-specific failures: `401 AUTHENTICATION_FAILED`, exact message `Unable to sign in with the provided credentials.`, no account-specific detail/fieldErrors (requestId may differ), no new session/authenticated session cookie; rate limit: `429 TOO_MANY_ATTEMPTS` + `Retry-After` | `server/tests/lab-03/auth.api.test.ts` | Planned |
| API-03 | API | BR-07, BR-10, AC-04 | Missing/invalid/expired/revoked session | 401, no protected data | `server/tests/lab-03/auth.api.test.ts` | Planned |
| API-04 | API | FR-02, AC-03 | Forced password user accesses endpoints | only me/change/logout allowed | `server/tests/lab-03/auth.api.test.ts` | Planned |
| API-05 | API | BR-04–BR-06, AC-03 | Change-password valid/invalid/boundary/rotation | flag clears; other sessions revoked | `server/tests/lab-03/auth.api.test.ts` | Planned |
| API-06 | API | FR-03, AC-04 | Logout with valid/missing session | 204 idempotent; cookie/session invalid | `server/tests/lab-03/auth.api.test.ts` | Planned |
| API-07 | Security | BR-09 | Missing/cross-origin mutation including Login before cookie exists | 403 before credential/body evaluation | `server/tests/lab-03/auth.api.test.ts` | Planned |
| API-08 | Security | BR-11–BR-14, AC-05 | Cross-role direct API matrix | 403/404 as contract; no data leak | `server/tests/lab-03/authorization.api.test.ts` | Planned |
| API-09 | Regression | FR-05, AC-06 | Supplied requesterId/header cannot switch identity | own data only; protected fields rejected/ignored | `server/tests/lab-03/authorization.api.test.ts` | Planned |
| API-10 | Regression | FR-05, AC-06–AC-07 | Lab 2 create/list/detail/attachments under session | prior behavior passes with auth | `server/tests/lab-03/requester-regression.api.test.ts` | Planned |
| API-11 | API | FR-07, AC-08 | Queue search across defined fields | only matching shared Tickets | `server/tests/lab-03/staff-queue.api.test.ts` | Planned |
| API-12 | API | FR-07, AC-08 | Queue filters individually/combined | correct status/priorities/owner rows | `server/tests/lab-03/staff-queue.api.test.ts` | Planned |
| API-13 | API | FR-07, AC-08 | Sort, tie-break, page metadata/boundaries | deterministic page results | `server/tests/lab-03/staff-queue.api.test.ts` | Planned |
| API-14 | API | FR-07, AC-08 | Invalid/unknown/duplicate query | 400; no silent fallback | `server/tests/lab-03/staff-queue.api.test.ts` | Planned |
| API-15 | API | FR-08, AC-05 | Staff Ticket Detail and attachment continuity | permitted complete detail; 404 missing | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Planned |
| API-16 | API | FR-09, AC-09 | Claim unassigned and conflict/concurrency | owner set once; 409 conflict | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Planned |
| API-17 | API | BR-16, BR-18, BR-36, AC-10 | Assign/reassign eligible staff/admin, terminal/bad target and races | valid persists; invalid/conflicting 409 | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Planned |
| API-18 | API | BR-19, AC-10 | IT Priority update versus Requested Priority | IT changes; requested remains unchanged | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Planned |
| API-19 | API | BR-16, BR-20–BR-22, AC-11 | All valid/invalid/terminal status changes | valid persists; terminal archives lastOwner and clears owner; invalid 409 | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Planned |
| API-20 | API | FR-11, BR-25–BR-27, AC-12 | Public Comment create/list/boundaries/order | append-only server author/time | `server/tests/lab-03/comments-notes.api.test.ts` | Planned |
| API-21 | Security | FR-12, BR-28, AC-13 | Requester accesses note routes/payloads/counts | forbidden/no note existence or content | `server/tests/lab-03/comments-notes.api.test.ts` | Planned |
| API-22 | API | FR-12, BR-25–BR-28 | Staff/Admin Internal Note create/list/boundaries | append-only server author/time | `server/tests/lab-03/comments-notes.api.test.ts` | Planned |
| API-23 | API | FR-06, BR-23, AC-14 | Problem Appears Resolved allowed/disallowed statuses, replay and Reopened cycle | allowed idempotent; terminal/formal states 409; status unchanged | `server/tests/lab-03/comments-notes.api.test.ts` | Planned |
| API-24 | API | FR-13, AC-15 | Admin list, name/email search, role filter | correct ordered safe users | `server/tests/lab-03/users-admin.api.test.ts` | Planned |
| API-25 | API | FR-14, AC-15–AC-16 | Create user/one role/duplicate/invalid | 201 valid; 400/409 invalid | `server/tests/lab-03/users-admin.api.test.ts` | Planned |
| API-26 | API | FR-14, AC-15–AC-16 | Edit name/email/role/activation | permitted fields persist safely | `server/tests/lab-03/users-admin.api.test.ts` | Planned |
| API-27 | Security | BR-31–BR-32, BR-36, AC-16 | Self-deactivation, last admin, active assignment, historical lastOwner, no delete | active conflict; history alone permits change and remains preserved | `server/tests/lab-03/users-admin.api.test.ts` | Planned |
| API-28 | API | FR-15, AC-15 | Set initial password and next login | sessions revoked; forced change true | `server/tests/lab-03/users-admin.api.test.ts` | Planned |
| API-29 | Security | BR-37, AC-13, AC-17 | Unexpected failures and response/log redaction | safe 500 + requestId; no secrets/private data | `server/tests/lab-03/safe-errors.api.test.ts` | Planned |
| API-30 | API/Security | FR-08, BR-14, AC-19 | Staff/Admin Attachment download; Requester, removed, wrong-Ticket and storage failures | authorized bytes/headers; safe 403/404/500, no path leak | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Planned |
| UI-01 | UI | FR-01, AC-01–AC-02, AC-17 | Login form validation/busy/errors/focus; unknown email/wrong password/inactive account | accessible states and routing; all account-specific failures show `Unable to sign in with the provided credentials.` without account-state hints or entry to authenticated shell | `client/tests/lab-03/Login.test.tsx` | Planned |
| UI-02 | UI | FR-02, AC-03, AC-17 | Password rules/change/Logout/focus | forced flow cannot bypass | `client/tests/lab-03/ChangePassword.test.tsx` | Planned |
| UI-03 | UI | FR-04, AC-04–AC-05 | Role shell nav/direct route/logout incl. Admin queue access | correct nav; forbidden protected | `client/tests/lab-03/AppAuthorization.test.tsx` | Planned |
| UI-04 | Regression | FR-05–FR-06, AC-06, AC-12, AC-14 | No selector; own Ticket/comment and status-aware resolution UI | authenticated requester flow works; terminal action absent | `client/tests/lab-03/RequesterRegression.test.tsx` | Planned |
| UI-05 | UI | FR-07, AC-08, AC-17 | Queue controls/URL/states/metadata retry | strict query and recoverable feedback | `client/tests/lab-03/StaffTicketQueue.test.tsx` | Planned |
| UI-06 | UI | FR-08–FR-12, AC-09–AC-14, AC-17, AC-19 | Staff detail controls/conflicts, active/final owner, Attachment download, comments/notes | role-safe operational flows and exact staff download route | `client/tests/lab-03/StaffTicketDetail.test.tsx` | Planned |
| UI-07 | UI | FR-13–FR-15, AC-15–AC-17 | User list/create/edit/password/safety feedback | minimal admin workflow accessible | `client/tests/lab-03/UserManagement.test.tsx` | Planned |
| UI-08 | UI/Security | BR-27–BR-28, AC-12–AC-13 | Malicious comment/note content rendering | rendered as text; notes remain private | `client/tests/lab-03/StaffTicketDetail.test.tsx` | Planned |
| RV-01 | Browser | AC-18 | Login/Change Password at 3 viewports + 200% | no overflow/clipping; keyboard usable | `e2e/lab-03/responsive-accessibility.spec.ts` | Planned |
| RV-02 | Browser | AC-18 | Staff Queue table/card representation | readable/usable all viewports | `e2e/lab-03/responsive-accessibility.spec.ts` | Planned |
| RV-03 | Browser | AC-18 | Staff Detail comments/notes/actions | no confusion/overlap; focus works | `e2e/lab-03/responsive-accessibility.spec.ts` | Planned |
| RV-04 | Browser | AC-18 | User Management list/forms/dialogs | responsive cards/forms/focus | `e2e/lab-03/responsive-accessibility.spec.ts` | Planned |
| A11Y-01 | Browser | AC-18 | axe, landmarks, names, contrast, live regions | no serious/critical violations | `e2e/lab-03/responsive-accessibility.spec.ts` | Planned |
| E2E-01 | E2E | AC-01–AC-05 | login → forced change → role home → logout | complete auth path passes | `e2e/lab-03/authentication.spec.ts` | Planned |
| E2E-02 | E2E | AC-08–AC-14 | queue → claim → priority/status → comment/note; requester indication | complete staff/requester collaboration | `e2e/lab-03/staff-ticket-flow.spec.ts` | Planned |
| E2E-03 | E2E | AC-15–AC-16 | create/edit/reset/deactivate safety and new-user login | complete admin path passes | `e2e/lab-03/user-administration.spec.ts` | Planned |

## 3. Acceptance-Criteria Traceability

| AC | Planned evidence |
|---|---|
| AC-01 | API-01, UI-01, E2E-01 |
| AC-02 | API-02, UI-01 |
| AC-03 | UT-02, API-04, API-05, UI-02, E2E-01 |
| AC-04 | API-03, API-06, UI-03, E2E-01 |
| AC-05 | API-08, UI-03, E2E-01–E2E-03 |
| AC-06 | API-09, API-10, UI-04 |
| AC-07 | DB-01–DB-04, API-10 |
| AC-08 | UT-05, API-11–API-14, UI-05, E2E-02 |
| AC-09 | DB-05, API-16, UI-06, E2E-02 |
| AC-10 | DB-06, API-17, API-18, UI-06, E2E-02 |
| AC-11 | UT-03, API-19, UI-06, E2E-02 |
| AC-12 | UT-04, API-20, UI-04, UI-06, E2E-02 |
| AC-13 | API-08, API-21, API-29, UI-08, E2E-02 |
| AC-14 | API-23, UI-04, UI-06, E2E-02 |
| AC-15 | API-24–API-26, API-28, UI-07, E2E-03 |
| AC-16 | DB-05–DB-06, API-25, API-27, UI-07, E2E-03 |
| AC-17 | API-29, UI-01–UI-07 |
| AC-18 | RV-01–RV-04, A11Y-01 |
| AC-19 | API-30, UI-06, E2E-02 |

## 4. Required Test Locations

```text
server/tests/lab-03/
├── auth.api.test.ts
├── authorization.api.test.ts
├── staff-queue.api.test.ts
├── staff-ticket-detail.api.test.ts
├── comments-notes.api.test.ts
└── users-admin.api.test.ts

client/tests/lab-03/
├── Login.test.tsx
├── ChangePassword.test.tsx
├── StaffTicketQueue.test.tsx
├── StaffTicketDetail.test.tsx
└── UserManagement.test.tsx

e2e/lab-03/
├── authentication.spec.ts
├── staff-ticket-flow.spec.ts
└── user-administration.spec.ts
```

Matrix อนุญาต test files เพิ่มเติม แต่ไฟล์ขั้นต่ำจาก labsheet ต้องมีหรือ documented mapping ต้องชัดเจนก่อน final submission

## 5. Planned Verification Commands

คำสั่งจริงอาจปรับตาม scripts ที่ implementation เพิ่ม และต้อง sync ก่อน merge:

```powershell
npm --prefix server ci
npm --prefix client ci
npm --prefix server run prisma:validate
npm --prefix server test
npm --prefix client test
npm --prefix server run lint
npm --prefix client run lint
npm --prefix server run build
npm --prefix client run build
npm --prefix client run test:e2e
git diff --check
```

## 6. Final Evidence

| Evidence | Commit/run | Result |
|---|---|---|
| Contract review | [PR #39 review on `b8e0412`](https://github.com/L0u1sss/TokTickIT/pull/39#pullrequestreview-5210534997) | Changes requested; Login failure contract remediation prepared locally, peer re-review pending |
| Migration + seed | Not run — implementation out of scope for Issue #29 | Planned |
| Server suites | Not run — implementation out of scope for Issue #29 | Planned |
| Client suites | Not run — implementation out of scope for Issue #29 | Planned |
| E2E/browser | Not run — implementation out of scope for Issue #29 | Planned |
| Hosted CI | Not available for implementation yet | Planned |
| Peer approval | Not available yet | Pending |

เมื่อ implementation เสร็จ ต้องใส่ exact final SHA, test counts, workflow run link และ screenshot paths ห้ามเขียน “all tests pass” โดยไม่มี reproducible evidence
