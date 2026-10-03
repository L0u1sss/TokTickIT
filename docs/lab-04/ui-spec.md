# TokTickIT Lab 4 — UI Specification

> Implemented contract through Issue #60. This document extends the Lab 3 Zen Green shell and component behavior. The Issue #60 checklist and evidence scope are recorded below.

## 1. Application Shell and Navigation

After authentication, the first role-appropriate route is Dashboard. Requesters see Dashboard, Create Ticket, and My Tickets. IT Staff see Dashboard and Ticket Queue. Administrators see Dashboard, Ticket Queue, and User Management. The active item uses text/shape/weight in addition to color; name, role, and Logout remain visible. Forced password-change flow cannot open dashboards.

PR #68 provides `/staff/dashboard` as the home and Requester-dashboard redirect target for IT Staff and Administrators. Opening `/dashboard` as either role replaces the URL with `/staff/dashboard`, discards Requester query parameters, and never requests Requester dashboard data. Administrators retain `/admin/users` navigation. Protected staff/admin screens show Forbidden to unauthorized roles; direct Requester dashboard API access by Staff/Admin remains `403`.

## 2. Shared UI Rules

- Reuse existing cards, tables, badges, form controls, buttons, alerts, skeleton/loading, empty, error, and responsive conventions.
- Status and priority always have visible text; private Internal Notes and shared Actions/Public Comments are labeled distinctly.
- Network writes disable the initiating control and display progress. Recoverable failure retains entered fields.
- Query strings and fragments are preserved, but screen selection and active role navigation use the pathname. Ticket Queue remains active on filtered queues and Ticket Detail. Both role shells provide a working keyboard skip link to main content.
- Action Submit validates the complete draft; blur feedback must not move a pointer target between pointer down and pointer up. The first invalid field receives focus, and error-summary links remain operable.
- Public Comment/Internal Note fields expose required, invalid and help semantics. Recoverable failures retain drafts; 401/403/404 remove prior entries and posting forms until a successful reload. Malformed responses produce safe failure feedback.
- Attachment removal keeps its dialog and reason while the write is pending. Escape is available before submission and after failure, and returns focus to the initiating control. Resolution indications and removal use synchronous submission guards.
- Feedback uses an accessible live region. Validation appears beside fields and in an error summary that links/focuses the first invalid field.
- A `409 STALE_ACTION`/`STALE_TICKET` explains that newer data exists, preserves the draft, and offers Reload; it never silently overwrites.

## 3. IT Staff and Administrator Dashboard

The page heading is “Dashboard” with last-refreshed information and Retry on failure. Metric cards show label, numeric value, and accessible drill-down action for Unassigned Open, Owned by Me, by Status, and by IT Priority. Separate compact lists show My Actions, Recently Updated Tickets, and High Priority Tickets. High Priority Tickets means exactly `itPriority=HIGH` across all statuses, using the bounded backend list ordered `updatedAt ASC, id ASC`; it does not imply SLA or an additional priority classification. Last refreshed displays the one UTC `generatedAt` captured before the transaction. Recently Updated follows authoritative Ticket `updatedAt`: accepted Ticket/Action aggregate writes refresh recency; Public Comments, Internal Notes, and attachment-only writes do not. My Actions contains the deduplicated union of Actions recorded by, assigned to, or performed by the signed-in user; show every matching `Recorded`, `Assigned`, and `Performed` label on one row. Each item exposes the identifiers needed to understand it and links to Ticket Detail; cards link to filtered Queue views.

Loading retains page structure without false zeroes. A successful zero dataset shows cards with `0` and an explanatory empty state. Forbidden and safe failures do not render stale privileged data. Administrator presentation is identical to staff for this sprint.

## 4. Requester Dashboard

The page shows Open Tickets and Waiting for You metric cards plus Recently Updated and Recently Resolved lists. Recently Updated uses the same authoritative Ticket `updatedAt` rule as the Staff Dashboard: accepted Ticket/Action aggregate writes refresh recency; Public Comments, Internal Notes, and attachment-only writes do not. Recently Resolved means current `RESOLVED`/`CLOSED` Tickets with `resolvedAt` in the backend's rolling 168-hour window `[from,before)`; render the returned window and use its exact bounds in the drill-down. It never includes another Requester’s data and does not duplicate the full My Tickets controls. Open drill-down uses `/tickets?status=OPEN_GROUP`; waiting uses `/tickets?status=WAITING_FOR_REQUESTER`; recently resolved uses `/tickets?statusIn=RESOLVED,CLOSED&resolvedFrom=<from>&resolvedBefore=<before>`, with returned values URL-encoded by the client. List items open owned Ticket Detail. Zero state provides a Create Ticket action. Failure/Retry preserves shell navigation.

Requester Recently Updated has no time cutoff by design: display the latest five owned Tickets across all current statuses, even when older than seven days. Recently Resolved alone has the seven-day boundary.

## 5. Actions Taken on Ticket Detail

### 5.1 List and read mode

Actions appear in stable oldest-first order. Every item shows created date/time, description, result or “Not recorded”, performer, assignee, status, follow-up requirement/note, attachment notes, and updated time. `Performed by` is the current assignee who completed the work; it is empty until completion. Only that assignee can complete the Action, so the displayed performer cannot accidentally identify a different staff member who merely recorded completion. The audit event records the authenticated completion actor. For cancelled Actions, display cancellation actor, timestamp, and whether cancellation came from staff or Ticket cancellation. When `followUpRequired=true` on a cancelled Action, label it as historical follow-up, not outstanding work. Requesters see this read-only shared view on owned Tickets. Internal Notes remain in their separate staff-only area.

### 5.2 Create mode

Staff/Admin select “Add Action”. The form contains Description, Assignee, optional Result, Follow-up Required checkbox, conditional Follow-up Note, and optional Attachment Notes. Performer/date/status are explained as automatic. A client-generated request ID remains stable across retry and changes only after confirmed success or intentional reset.

### 5.3 Edit and lifecycle mode

Authorized staff can open Edit, change contract-approved fields on non-terminal Actions, and Save/Cancel. Lifecycle controls expose only valid next states. Only the current assignee sees/enables Complete; other staff receive a clear “Only the assigned staff member can complete this Action” explanation. Complete requires Result and cleared follow-up; staff Cancel also requires cleared follow-up. `COMPLETED` and `CANCELLED` Actions are read-only terminal records; later work is a new Action, never a reopen. A Ticket-cascade-cancelled Action shows the cancellation actor/time/source and retains follow-up fields with a historical-only label. Actions are read-only and cannot be created on `RESOLVED`, `CLOSED`, or `CANCELLED` Tickets; the user must reopen the Ticket to start a new workflow cycle. Every Ticket aggregate write (claim, owner assignment/reassignment, priority, status, Action create/edit/transition) sends the displayed integer Ticket version; Action writes also send the Action revision. Reassignment/completion races resolve from server state; a former assignee receives stale/conflict feedback and must reload. On success, replace the locally held Ticket version with the returned `version`/`ticketVersion` before enabling another write, then refresh affected summaries.

Inactive assignee, resolution-gate failure, and stale data have specific messages and recovery actions. The UI cannot imply that hiding a control provides authorization.

## 6. Ticket Workflow Feedback

Ticket status options come from the current matrix. Moving to Resolved requires confirmation and completed work in the current workflow cycle, with Result, no active Actions, and no outstanding follow-up on non-cancelled Actions. Cancelling a Ticket updates each active Action to a terminal cancelled record with cancellation provenance; preserved follow-up is historical-only. Claim, owner, priority, status, and Action mutation controls all submit the current Ticket version; stale conflicts preserve drafts and offer reload/reapply. Server rejection names safe reason codes without exposing private data. Requester “Problem Appears Resolved” remains wording distinct from formal “Resolve Ticket”. After success, heading badge, permitted actions, owner summary, and relevant lists refresh with the returned version.

## 7. URL and Drill-down Contract

Requester Dashboard is `/dashboard`; staff/admin Dashboard is `/staff/dashboard`. Action deep links use the appropriate Ticket Detail route with `#actions`. Dashboard filters use existing URL query state so refresh/back/forward preserve context. Unknown query values show validated recovery rather than silently changing meaning.

## 8. State Matrix

| Area | Loading | Empty | Forbidden/not found | Conflict | Safe failure |
|---|---|---|---|---|---|
| Dashboards | structural loading state | zero cards + useful action | role redirect/403 page | n/a | alert + Retry |
| Action list | inline loading | “No actions recorded” | no cross-owner disclosure | n/a | alert + Retry |
| Action form | disabled submit/progress | n/a | close protected form | keep draft + Reload | keep draft + Retry |
| Ticket workflow | disable current action | n/a | safe feedback | refresh current state | Retry after state reload |

## 9. Responsive Rules

Baseline evidence uses desktop `1440×900`, tablet `834×1112`, and mobile `390×844`. Desktop may use card grids and tables; tablet reduces columns; mobile stacks metric cards and uses action cards rather than squeezed tables. No page-level horizontal scroll, clipping, overlap, or inaccessible fixed dialog is allowed. Long descriptions, names, and attachment notes wrap. Touch targets are at least 44×44 CSS pixels on mobile.

## 10. Accessibility Rules

- One clear page heading, semantic landmarks, labeled regions, and meaningful control names.
- Full keyboard operation, visible focus, logical focus order, and focus return after dialogs/forms close.
- Errors and success are announced; required/conditional fields are programmatically conveyed.
- Color is never the sole status/priority/follow-up cue. Text contrast follows the established accessible Zen Green palette.
- Dialogs trap focus while open, close with Escape where safe, and place focus on the heading/first invalid control as appropriate.
- Automated axe checks allow no serious/critical violations. Issue #60's fixture audit asserts **no axe violations** and exercises actual Tab/Shift+Tab/Enter/Escape, focus and 720×450 viewport reflow. This supplements independent manual browser zoom and screen-reader review; it does not claim those unperformed checks.

## 11. Visual Evidence Checklist

- [x] Staff/Administrator Dashboard, Requester Dashboard, and Actions area at all three baseline viewports; additional 720×450 reflow fixtures.
- [x] Non-zero and zero dashboard states; fresh real dashboard metrics verified against direct database queries by the live dashboard suite. Staff zero rendering is an injected UI fixture, with real-empty API coverage in the server suite.
- [x] Multiple Actions on one Ticket, different performers/assignees, terminal/cancelled history and explicit historical follow-up labels.
- [x] Create/edit/start/complete/cancel, first-invalid-field validation, inactive assignee, stale conflict, safe failure, retained drafts and stable retry request ID covered by real Action workflows and UI fixtures.
- [x] Permitted Ticket transitions, current-cycle resolution gate, advisory distinction and refreshed Ticket summary covered by the live workflow suite.
- [x] Keyboard skip/drill-down, visible focus, labels, error placement, non-color cues, modal Tab/Shift+Tab/Escape/focus return, wrapping, control bounds, clipping, overlap and page overflow checked automatically.
- [x] Source audit found no TODO/FIXME, coming-soon/unimplemented controls or empty `href="#"` links. Exercised routes and captured fixture states have no unexpected console/page errors. Existing loading/disabled controls have documented behavior.

## Issue #60 Visual and Accessibility Evidence

The deterministic audit (`npm --prefix client run test:ui:lab4`) covers Requester, IT Staff and Administrator at `1440×900`, `834×1112`, `390×844` and `720×450`, and produces **63 screenshot/JSON pairs**. Each JSON records axe findings, viewport/page widths, visible control bounds, clipping and overlap findings, the Zen Green primary token and computed outlines. Mobile audited controls have at least 44×44 targets; checkbox labels provide the larger clickable area. Dialog images capture the viewport so fixed overlays remain readable. Representative Administrator/tablet, Action/mobile-validation and attachment/reflow images were inspected visually in addition to the automated checks.

| Check | Evidence and scope |
|---|---|
| Consistent shell/navigation/cards/badges/forms | All-role fixture audit; correct pathname selection and active navigation with query/hash context; Zen Green `#006b3c` |
| Dashboard labels/counts/drill-down | Fixture keyboard Enter and role navigation; live dashboard suite separately checks direct database metrics and exact query links |
| Editable/read-only Actions | Create validation/Escape/focus return, planned/completed/cancelled shared list and requester read-only fixtures; real create/edit/lifecycle/inactive-assignee/stale/idempotent API flows |
| Accessible errors and recovery | Required/invalid/described fields, first-error focus and live alerts; draft retained through 500/conflict/reload; protected communication entries/forms removed after denial |
| Focus and dialogs | Tab/Shift+Tab/Enter/Escape for all roles; skip-link main focus, drill-down outline, Action return focus, attachment/admin dialog trap and trigger return; pending-removal Escape blocked by component regression |
| Responsive geometry | Zero page overflow, out-of-viewport audited controls, clipped sampled text or overlapping audited controls in every captured state; long unbroken names/descriptions/filename fixtures |
| Accessibility and console | No WCAG-tagged axe violations in 63 fixture captures; live Action/dashboard/workflow suites reject serious/critical findings; no unexpected fixture console or page errors |

[Screenshot and assertion catalog](./ui-evidence-60.md), [Issue #60 test results and provenance](./tests.md#issue-60-verification).

These completed checks describe automated browser interaction and representative screenshot inspection. A `720×450` viewport is an automated reflow proxy for a `1440×900` desktop at 200%; independent manual browser zoom and screen-reader review remain unperformed. Hosted CI, peer approval and final-main/PDF release evidence remain separate release work, not claims made by this checklist.


## PR #68 Staff Dashboard Evidence ? 2026-10-03

- [x] Staff and Administrator non-zero Dashboard at 1440x900, 834x1112 and 390x844; original Staff Dashboard grid CSS retained after integration.
- [x] Every metric matches fresh direct database counts; all ownership/status/priority drill-down links preserve their filters.
- [x] My Actions shows all matching Recorded/Assigned/Performed labels without duplicate rows; terminal history remains eligible under BR-28.
- [x] Ticket and Action links work; `#actions` survives session restoration and scrolls to one unique Actions region after Detail loads.
- [x] Loading, safe failure/retry, zero UI fixture and Requester Forbidden captured; privileged summaries are absent on denial.
- [x] Captured states have no page overflow and no serious/critical axe violations; 720x450 reflow viewport also checked.

See [PR #68 validation](./tests.md#pr-68-validation) for logs, screenshot links, database provenance and the distinction between injected UI fixtures, real API/service tests, automated reflow and unperformed manual review.

## Issue #61 Candidate Evidence

The complete [Issue #61 candidate run](tests.md#issue-61-release-candidate-verification)
re-ran the same keyboard/geometry/axe and authenticated live suites successfully,
archiving 159 screenshots and all 63 fixture PNG/JSON pairs under
`artifacts/lab-04/issue-61/release-candidate/screenshots/`. The [single report](report.md)
uses readable excerpts from original screenshot bytes and records crop coordinates
and original image hashes; it identifies live versus injected UI states explicitly.
Representative report screenshots and Thai text were inspected after rendering.
The published historical screenshots and earlier local checks retain their original
scope. Actual feature peer approvals/staging CI are recorded in [reviewer.md](reviewer.md).
Final-main acceptance and unperformed independent manual zoom/screen-reader checks
are not inferred from the candidate report.
