# TokTickIT Lab 4 — UI Specification

> Proposed contract for Issue #52. This document extends the Lab 3 Zen Green shell and component behavior.

## 1. Application Shell and Navigation

After authentication, the first role-appropriate route is Dashboard. Requesters see Dashboard, Create Ticket, and My Tickets. IT Staff see Dashboard and Ticket Queue. Administrators see Dashboard, Ticket Queue, and User Management. The active item uses text/shape/weight in addition to color; name, role, and Logout remain visible. Forced password-change flow cannot open dashboards.

PR #68 provides `/staff/dashboard` as the home and Requester-dashboard redirect target for IT Staff and Administrators. Opening `/dashboard` as either role replaces the URL with `/staff/dashboard`, discards Requester query parameters, and never requests Requester dashboard data. Administrators retain `/admin/users` navigation. Protected staff/admin screens show Forbidden to unauthorized roles; direct Requester dashboard API access by Staff/Admin remains `403`.

## 2. Shared UI Rules

- Reuse existing cards, tables, badges, form controls, buttons, alerts, skeleton/loading, empty, error, and responsive conventions.
- Status and priority always have visible text; private Internal Notes and shared Actions/Public Comments are labeled distinctly.
- Network writes disable the initiating control and display progress. Recoverable failure retains entered fields.
- Feedback uses an accessible live region. Validation appears beside fields and in an error summary that links/focuses the first invalid field.
- A `409 STALE_ACTION`/`STALE_TICKET` explains that newer data exists, preserves the draft, and offers Reload; it never silently overwrites.

## 3. IT Staff and Administrator Dashboard

The page heading is “Dashboard” with last-refreshed information and Retry on failure. Metric cards show label, numeric value, and accessible drill-down action for Unassigned Open, Owned by Me, by Status, and by IT Priority. Separate compact lists show My Actions, Recently Updated Tickets, and Urgent Tickets. Recently Updated follows authoritative Ticket `updatedAt`: accepted Ticket/Action aggregate writes refresh recency; Public Comments, Internal Notes, and attachment-only writes do not. My Actions contains the deduplicated union of Actions recorded by, assigned to, or performed by the signed-in user; show every matching `Recorded`, `Assigned`, and `Performed` label on one row. Each item exposes the identifiers needed to understand it and links to Ticket Detail; cards link to filtered Queue views.

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
- Automated axe checks allow no serious/critical violations; keyboard and 200% reflow remain manual evidence.

## 11. Visual Evidence Checklist

- [ ] Staff Dashboard, Requester Dashboard, and Actions area at all three baseline viewports.
- [ ] Non-zero and zero dashboard states with counts verified against database queries.
- [ ] Action list with different performers/assignees and multiple Actions on one Ticket.
- [ ] Create/edit/complete/cancel, validation, inactive-assignee, stale conflict, and safe-failure states.
- [ ] Permitted Ticket transitions and resolution-gate feedback.
- [ ] Keyboard focus, labels, error placement, non-color cues, wrapping, clipping, overlap, and overflow checked.
- [ ] Temporary/duplicate/obsolete Lab UI and unfinished controls removed.


## PR #68 Staff Dashboard Evidence ? 2026-10-03

- [x] Staff and Administrator non-zero Dashboard at 1440x900, 834x1112 and 390x844; original Staff Dashboard grid CSS retained after integration.
- [x] Every metric matches fresh direct database counts; all ownership/status/priority drill-down links preserve their filters.
- [x] My Actions shows all matching Recorded/Assigned/Performed labels without duplicate rows; terminal history remains eligible under BR-28.
- [x] Ticket and Action links work; `#actions` survives session restoration and scrolls to one unique Actions region after Detail loads.
- [x] Loading, safe failure/retry, zero UI fixture and Requester Forbidden captured; privileged summaries are absent on denial.
- [x] Captured states have no page overflow and no serious/critical axe violations; 720x450 reflow viewport also checked.

See [PR #68 validation](./tests.md#pr-68-validation) for logs, screenshot links, database provenance and the distinction between injected UI fixtures, real API/service tests, automated reflow and unperformed manual review.
