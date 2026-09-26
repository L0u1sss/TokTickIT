# TokTickIT Lab 4 — Sprint Engineering Specification

> Status: Proposed contract for peer review before implementation
>
> Source: `SE+Lab+4.pdf`, the Lab 3 contract, and GitHub Issue #52
> Any implementation change must update this contract and its test traceability first.

## 1. Sprint Goal

Complete the core service-desk lifecycle by adding traceable Actions Taken, authoritative resolution rules, and concise role dashboards while preserving every approved Lab 1–3 behavior. The increment must remain secure, responsive, accessible, recoverable after failures, and demonstrable from database evidence through the UI.

## 2. Stakeholder Request

IT Staff need a reliable record of planned and completed work beneath each Ticket. The primary Ticket Owner coordinates the Ticket, while another eligible staff member may be assigned an Action and the authenticated user who records the work remains auditable. Requesters need a concise view of their own work; staff need an operational starting point. Dashboard summaries must lead back to the detailed records and must never replace them.

## 3. Scope

### 3.1 Included

- Actions Taken data model, migration, idempotent seed, REST API, authorization, UI, lifecycle, audit history, concurrency handling, and tests.
- Final eight-state Ticket workflow with a backend-enforced resolution gate.
- Requester dashboard scoped to the authenticated Requester.
- IT Staff dashboard, also available to Administrators, with operational metrics and drill-down links.
- Preservation and regression of authentication, authorization, Requester, staff, admin, comments, notes, attachments, and user-management behavior.
- Zen Green design consistency, responsive layouts, accessibility, safe failures, performance smoke checks, and release evidence.

### 3.2 Explicitly excluded

- SLA clocks, escalation engines, on-call scheduling, and breach notifications.
- Email, SMS, LINE, push, or other external notification services.
- Inventory, spare parts, purchasing, service cost accounting, payroll, billing, and labor-cost calculations.
- Multi-level approvals, electronic signatures, advanced BI, custom report builders, and export warehouses.
- Multi-tenant organizations, production-scale cloud operations, and unapproved Sprint 4 features.

## 4. Functional Requirements

- **FR-01 — Action list:** Authorized users can retrieve a stable chronological list of Actions for an accessible Ticket.
- **FR-02 — Action creation:** IT Staff and Administrators can create an Action with description, optional initial result, eligible assignee, follow-up fields, and attachment notes. The backend records creator and time.
- **FR-03 — Action update:** IT Staff and Administrators can update editable Action content, assignee, and lifecycle using the latest revision.
- **FR-04 — Action visibility:** A Requester can read all Actions on their own Ticket but cannot create or change them. Internal Notes remain private and separate.
- **FR-05 — Action lifecycle:** Permitted staff can move Actions through `PLANNED`, `IN_PROGRESS`, `COMPLETED`, and `CANCELLED` using the approved transition matrix.
- **FR-06 — Action audit:** Material Action changes produce append-only audit events with actor, time, revision, event type, and changed-field summary.
- **FR-07 — Ticket workflow:** The backend enforces all Ticket transitions and the resolution gate even if the UI is bypassed.
- **FR-08 — Requester advisory:** “Problem Appears Resolved” remains advisory and never changes formal Ticket status by itself.
- **FR-09 — Requester dashboard:** A Requester receives only their own counts and recent Ticket summaries, with drill-down to My Tickets or Ticket Detail.
- **FR-10 — Staff dashboard:** IT Staff and Administrators receive operational counts, current-user Action information, and recent/urgent Tickets with drill-down to Queue or Ticket Detail.
- **FR-11 — Dashboard authority:** Metrics are calculated by the backend from authoritative data and returned as concise aggregates, not complete Ticket collections.
- **FR-12 — Data continuity:** Migration preserves all existing Users, Tickets, Attachments, Public Comments, Internal Notes, and ownership/history.
- **FR-13 — Safe interaction:** Forms prevent accidental duplicate submission, retain user input after recoverable failure, and report validation, forbidden, not-found, conflict, and safe server failures consistently.
- **FR-14 — Product regression:** All approved Labs 1–3 screens and APIs remain available to permitted roles.
- **FR-15 — Product quality:** Lab 4 screens meet the existing responsive, keyboard, focus, semantic-label, non-color cue, and visual-consistency contract.

## 5. Business Rules

### 5.1 Action identity, fields, and ownership

- **BR-01:** Each Action belongs to exactly one Ticket and cannot be moved between Tickets.
- **BR-02:** Ticket `ownerId` coordinates the whole Ticket; Action `assigneeId` identifies responsibility for one Action; `performedById` is the authenticated creator and may differ from both.
- **BR-03:** Required stored fields are `id`, `ticketId`, `description`, `status`, `performedById`, `assigneeId`, `followUpRequired`, `followUpNote`, `attachmentNotes`, `revision`, `createdAt`, and `updatedAt`. `result` and `completedAt` are nullable until completion.
- **BR-04:** `createdAt` is the authoritative Action Date/Time requested by the handout and is set by the backend. Clients cannot backdate it. `completedAt` is set by the backend on completion and cleared only when the approved transition reopens the Action.
- **BR-05:** Description is 1–2,000 Unicode code points after trim; Result is 1–2,000 when present; Follow-up Note and Attachment Notes are each 1–1,000 when present. All render as plain text.
- **BR-06:** `followUpRequired=true` requires a non-empty Follow-up Note. When false, the persisted note must be `null` to avoid contradictory state.
- **BR-07:** Attachment Notes describe which existing Ticket attachment to inspect; Lab 4 does not add Action-specific file upload or a filename foreign key.
- **BR-08:** `assigneeId` must reference an active `IT_STAFF` or `ADMINISTRATOR`. Inactive or Requester assignees return `409 INVALID_ACTION_ASSIGNEE`.
- **BR-09:** Deactivating or demoting a user with a non-terminal assigned Action is blocked with `409 USER_HAS_ASSIGNED_ACTIONS`. Historical performer and terminal assignee references do not block account changes.

### 5.2 Action lifecycle, editing, and auditability

- **BR-10:** Action statuses are `PLANNED`, `IN_PROGRESS`, `COMPLETED`, and `CANCELLED`; a new Action starts `PLANNED`.
- **BR-11:** Permitted transitions are `PLANNED → IN_PROGRESS|CANCELLED`, `IN_PROGRESS → COMPLETED|CANCELLED`, `COMPLETED → IN_PROGRESS`, and `CANCELLED → PLANNED`. Same-state submission is rejected as an invalid transition.
- **BR-12:** Completion requires a non-empty Result. Cancellation preserves existing content and audit history; deletion is not supported.
- **BR-13:** Description, result, assignee, follow-up fields, and attachment notes can be edited by authorized staff. `ticketId`, creator, creation time, and event history are immutable.
- **BR-14:** The current Action row is editable, while every create, content edit, assignment change, and status change creates an append-only `ActionEvent`. “Append-only behavior” in the rubric applies to audit events, Public Comments, and Internal Notes—not to the mutable current Action projection.
- **BR-15:** Action list ordering is `createdAt ASC, id ASC`; event ordering is `createdAt ASC, id ASC`. Clients must not silently reorder equal timestamps.
- **BR-16:** Every Action write includes the expected integer `revision`. The update predicate includes current revision and increments it atomically. A stale write returns `409 STALE_ACTION` with no partial change.
- **BR-17:** Action creation accepts a UUID `clientRequestId`, unique per Ticket, so retrying after a lost response returns the original Action with `replayed=true` and creates no duplicate event.
- **BR-18:** Actor, timestamps, lifecycle outcome, revision, and event metadata come from the backend; protected client fields are rejected.

### 5.3 Ticket status and resolution

- **BR-19:** Ticket statuses remain `NEW`, `OPEN`, `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, `RESOLVED`, `CLOSED`, `REOPENED`, and `CANCELLED`.
- **BR-20:** The Lab 3 transition matrix remains authoritative: `NEW→OPEN|CANCELLED`; `OPEN→IN_PROGRESS|WAITING_FOR_REQUESTER|RESOLVED|CANCELLED`; `IN_PROGRESS→WAITING_FOR_REQUESTER|RESOLVED|CANCELLED`; `WAITING_FOR_REQUESTER→IN_PROGRESS|RESOLVED|CANCELLED`; `RESOLVED→REOPENED|CLOSED`; `REOPENED→IN_PROGRESS|WAITING_FOR_REQUESTER|RESOLVED|CANCELLED`; `CLOSED→REOPENED`; `CANCELLED→REOPENED`.
- **BR-21:** Transitioning to `RESOLVED` requires at least one `COMPLETED` Action with a non-empty Result. This is the Sprint 4 resolution gate. It does not require every Action to be terminal because follow-up work may remain planned.
- **BR-22:** `CLOSED` still requires current status `RESOLVED`; `CANCELLED` does not require an Action because work may be cancelled before execution.
- **BR-23:** The resolution check and Ticket status update occur in one database transaction. The request supplies expected Ticket `updatedAt`; mismatch returns `409 STALE_TICKET`.
- **BR-24:** A Requester resolution indication records advisory actor/time only. It neither satisfies BR-21 nor grants a Requester a status transition.
- **BR-25:** Reopening a Ticket clears the active Requester indication as in Lab 3 but retains all Actions and audit events.

### 5.4 Dashboard calculations

- **BR-26:** “Open Tickets” means status in `NEW`, `OPEN`, `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, or `REOPENED`; terminal/resolution statuses are excluded.
- **BR-27:** Requester metrics are: `openCount`; `waitingForRequesterCount`; up to five `recentlyUpdated` Tickets ordered `updatedAt DESC, id DESC`; and up to five `recentlyResolved` Tickets in `RESOLVED` or `CLOSED`, using `updatedAt DESC, id DESC`. Every query includes authenticated `requesterId`.
- **BR-28:** Staff metrics are: `unassignedOpenCount`; `ownedByMeOpenCount`; counts for every Ticket status; counts for every IT Priority; up to five `recentlyUpdated` open Tickets; up to five `urgentTickets` with `itPriority=HIGH`, ordered `updatedAt ASC, id ASC`; and up to five current-user Actions where `assigneeId=currentUser` and status is `PLANNED` or `IN_PROGRESS`, ordered `updatedAt DESC, id DESC`.
- **BR-29:** Administrator reuses the Staff dashboard. User-account counts are excluded from required Sprint 4 scope.
- **BR-30:** Dashboard time values are stored/returned in UTC ISO 8601. The chosen metrics use no calendar-day boundary; UI formats time in the browser locale. This avoids ambiguous server-local dates.
- **BR-31:** Zero counts return numeric `0`; lists return `[]`. Cards always render, and applicable cards link to documented Queue/My Tickets filters. Recent items link to Ticket Detail.
- **BR-32:** Dashboard responses contain counts and bounded summaries only. Metric queries use the same status/priority definitions as drill-down endpoints.

### 5.5 Authorization, failures, and continuity

- **BR-33:** Backend authorization is authoritative. Requesters receive safe `404` for another Requester’s Ticket; role-level access failures use `403`.
- **BR-34:** IT Staff and Administrators can create/update Actions on staff-accessible Tickets. Requesters can only list Actions through their owned-Ticket route.
- **BR-35:** Existing authentication, Origin/CSRF policy, no-store headers, request IDs, and safe error envelope remain in force.
- **BR-36:** Unexpected errors disclose no SQL, paths, stack traces, tokens, hashes, private notes, or cross-owner data.
- **BR-37:** Migration is additive. Legacy Tickets legitimately have zero Actions and remain visible in all lists/dashboards; they cannot transition to `RESOLVED` until BR-21 is met, but existing `RESOLVED`/`CLOSED` data is not rewritten.
- **BR-38:** Seed is idempotent and includes all Ticket statuses/priorities, assigned/unassigned Tickets, zero/one/multiple Actions, and data producing zero and non-zero dashboard states.
- **BR-39:** Existing attachment, comment, note, account-safety, ownership, and session invariants remain unchanged unless this document explicitly extends them.

## 6. Authorization Matrix

| Capability | Requester | IT Staff | Administrator |
|---|---:|---:|---:|
| View Actions on owned Ticket | Yes | n/a | n/a |
| View Actions through staff Ticket access | No | Yes | Yes |
| Create/edit/assign/transition Action | No | Yes | Yes |
| Requester dashboard | Own data | No | No |
| Staff dashboard | No | Yes | Yes |
| Formal Ticket transition | No | Yes | Yes |
| Problem Appears Resolved | Own Ticket | Read indication | Read indication |
| User Management | No | No | Yes |

## 7. UI Specification Summary

- Role-appropriate Dashboard navigation is added to the authenticated shell with a non-color active-page cue.
- Staff Dashboard uses concise metric cards plus bounded Actions/recent/urgent lists. Requester Dashboard uses own-Ticket metrics and bounded recent lists.
- Ticket Detail adds an Actions Taken region with stable list, create form, view/edit mode, lifecycle controls, revision-conflict recovery, and read-only Requester presentation.
- Status controls expose only permitted transitions, explain a failed resolution gate, and refresh Ticket summary after success.
- All screens support loading, empty, forbidden, not-found, conflict, safe-failure, retry, and success states where applicable.
- Normative screen behavior is in [ui-spec.md](./ui-spec.md).

## 8. Data Changes

Add `ActionTaken` with the fields in BR-03 plus `clientRequestId UUID`, unique `(ticketId, clientRequestId)`, foreign keys to Ticket/User, and indexes on `(ticketId, createdAt, id)`, `(assigneeId, status, updatedAt, id)`, and `(status, updatedAt, id)`. Add `ActionEvent` with `actionId`, `actorId`, `eventType`, `fromStatus`, `toStatus`, `changedFields` JSON, `revision`, and `createdAt`, indexed by `(actionId, createdAt, id)`.

Decision 1: keep the mutable Action projection plus immutable events. This supports the required edit UI while meeting append-only auditability without reconstructing every screen from events. Decision 2: use integer revision optimistic concurrency rather than long database locks across user think time. It gives a clear `409` recovery path and prevents silent overwrite. Decision 3: retain user foreign keys with `Restrict`; deactivation preserves authorship and assignment history.

Migration is additive and contains no destructive backfill. Recovery is restore-from-backup or a forward corrective migration; rollback may drop new tables only before real Actions exist. The migration must be tested both on an empty database and a populated Lab 3 fixture.

## 9. API Contract Summary

Staff routes provide Action list/create/update/transition and dashboards; Requester routes provide owned Action list and dashboard. Writes require approved Origin, authenticated role, strict fields, current revision where applicable, and safe validation/conflict errors. Dashboard routes return concise aggregate schemas. Exact endpoints and payloads are in [api-spec.md](./api-spec.md).

## 10. Acceptance Criteria

- **AC-01:** A valid staff user creates an Action under the correct Ticket; creator/time are authoritative and retry creates one record.
- **AC-02:** Action fields, conditional follow-up note, text boundaries, eligible assignee, and protected fields are enforced by API and UI.
- **AC-03:** Authorized staff can edit and transition an Action; completion requires Result and every material change appends an audit event.
- **AC-04:** Stale Action/Ticket writes return `409` without overwriting newer data; the UI offers reload and preserves recoverable input.
- **AC-05:** Requesters see all Actions only on their own Tickets and cannot write them; Internal Notes never leak.
- **AC-06:** Ticket transitions follow the eight-status matrix and the backend resolution gate; Requester advisory alone never resolves a Ticket.
- **AC-07:** Requester dashboard metrics, bounded lists, empty states, and drill-down contain only authenticated-owner data and match database queries.
- **AC-08:** Staff/Admin dashboard metrics, current-user Actions, urgent/recent lists, empty states, and drill-down match database queries.
- **AC-09:** Migration preserves populated Lab 3 data; fresh deploy, recovery approach, and repeated seed are verified.
- **AC-10:** Duplicate clicks/network retry do not duplicate Actions, and safe failures do not discard recoverable form input.
- **AC-11:** Authentication, Requester, Ticket, Attachment, comment/note, staff operations, and admin management regression tests pass.
- **AC-12:** Major Lab 4 screens pass responsive and accessibility checks at `1440×900`, `834×1112`, and `390×844` with no page-level horizontal overflow.
- **AC-13:** Documentation, test traceability, peer review, CI evidence, screenshots, and one nine-part submission PDF reflect final `main`.

## 11. Product Definition of Done

- [ ] FR/BR/AC reviewed before implementation and changes versioned with reasons.
- [ ] Additive migration and idempotent seed pass on empty and populated databases.
- [ ] Backend authorization, validation, idempotency, audit, concurrency, and safe failures are tested.
- [ ] Actions, Ticket workflow, both dashboards, and drill-down operate end-to-end.
- [ ] Labs 1–3 regression, lint, builds, unit/API/UI/E2E, performance smoke, responsive, and accessibility checks pass on final SHA.
- [ ] No secrets, generated reports, private uploads, placeholders, broken links, or known console errors are committed.
- [ ] `reviewer.md` records real review comments/responses/approval; `ai-use.md` records actual prompts and reflection.
- [ ] Feature branches merge into `lab4-staging`, then a reviewed release PR merges into `main`; Project/Kanban matches reality.
- [ ] Final evidence uses the exact Answer Part 1–9 order required by the handout.

## 12. Assumptions and Decisions

The handout lists assign/complete/cancel and inactive-assignee rejection in its grading evidence without defining Action assignee/status fields; BR-02 and BR-10–BR-12 resolve that gap. “Append-only” conflicts with an editable Action UI if applied to the current row; BR-14 applies it to immutable audit events while preserving authorized edits. The handout requires a resolution rule but does not dictate its predicate; BR-21 chooses one completed Action with Result as the smallest auditable gate. These are project decisions, not quotations from the handout, and must be reviewed before implementation.

## 13. Branch and Review Flow

Each issue branch starts from current `lab4-staging`, targets `lab4-staging` in its implementation PR, passes scoped and regression checks, receives peer review, and uses `Refs #<issue>`. After all Sprint 4 issues are Done, the release PR from `lab4-staging` to `main` uses `Closes` for the release issue only after final CI and approval.
