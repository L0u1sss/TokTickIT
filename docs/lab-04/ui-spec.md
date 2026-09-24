# TokTickIT Lab 4 — UI Specification

> Proposed contract for Issue #52. This document extends the Lab 3 Zen Green shell and component behavior.

## 1. Application Shell and Navigation

After authentication, the first role-appropriate route is Dashboard. Requesters see Dashboard, Create Ticket, and My Tickets. IT Staff see Dashboard and Ticket Queue. Administrators see Dashboard, Ticket Queue, and User Management. The active item uses text/shape/weight in addition to color; name, role, and Logout remain visible. Forced password-change flow cannot open dashboards.

## 2. Shared UI Rules

- Reuse existing cards, tables, badges, form controls, buttons, alerts, skeleton/loading, empty, error, and responsive conventions.
- Status and priority always have visible text; private Internal Notes and shared Actions/Public Comments are labeled distinctly.
- Network writes disable the initiating control and display progress. Recoverable failure retains entered fields.
- Feedback uses an accessible live region. Validation appears beside fields and in an error summary that links/focuses the first invalid field.
- A `409 STALE_ACTION`/`STALE_TICKET` explains that newer data exists, preserves the draft, and offers Reload; it never silently overwrites.

## 3. IT Staff and Administrator Dashboard

The page heading is “Dashboard” with last-refreshed information and Retry on failure. Metric cards show label, numeric value, and accessible drill-down action for Unassigned Open, Owned by Me, by Status, and by IT Priority. Separate compact lists show My Actions, Recently Updated Tickets, and Urgent Tickets. Each item exposes the identifiers needed to understand it and links to Ticket Detail; cards link to filtered Queue views.

Loading retains page structure without false zeroes. A successful zero dataset shows cards with `0` and an explanatory empty state. Forbidden and safe failures do not render stale privileged data. Administrator presentation is identical to staff for this sprint.

## 4. Requester Dashboard

The page shows Open Tickets and Waiting for You metric cards plus Recently Updated and Recently Resolved lists. It never includes another Requester’s data and does not duplicate the full My Tickets controls. Cards drill into My Tickets; list items open owned Ticket Detail. Zero state provides a Create Ticket action. Failure/Retry preserves shell navigation.

## 5. Actions Taken on Ticket Detail

### 5.1 List and read mode

Actions appear in stable oldest-first order. Every item shows created date/time, description, result or “Not recorded”, performer, assignee, status, follow-up requirement/note, attachment notes, and updated time. Requesters see this read-only shared view on owned Tickets. Internal Notes remain in their separate staff-only area.

### 5.2 Create mode

Staff/Admin select “Add Action”. The form contains Description, Assignee, optional Result, Follow-up Required checkbox, conditional Follow-up Note, and optional Attachment Notes. Performer/date/status are explained as automatic. A client-generated request ID remains stable across retry and changes only after confirmed success or intentional reset.

### 5.3 Edit and lifecycle mode

Authorized staff can open Edit, change contract-approved fields, and Save/Cancel. Lifecycle controls expose only valid next states. Complete requires Result; Cancel and reopening actions require confirmation because they alter operational meaning. A success refreshes both the Action and Ticket summary/dashboard-invalidated data.

Inactive assignee, resolution-gate failure, and stale data have specific messages and recovery actions. The UI cannot imply that hiding a control provides authorization.

## 6. Ticket Workflow Feedback

Ticket status options come from the current matrix. Moving to Resolved requires confirmation and completed-work evidence; server rejection names the missing condition without exposing private data. Requester “Problem Appears Resolved” remains wording distinct from formal “Resolve Ticket”. After success, heading badge, permitted actions, owner summary, and relevant lists refresh.

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
