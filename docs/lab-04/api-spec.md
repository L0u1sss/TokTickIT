# TokTickIT Lab 4 — REST API Contract

> Proposed contract for Issue #52. Paths extend the Lab 3 API; unchanged Lab 1–3 routes retain their prior contract.

## 1. Conventions

- JSON uses UTF-8 and ISO 8601 UTC timestamps. IDs are positive base-10 integers.
- All routes except `/api/health` and authentication require the existing `toktickit_session`; responses use `Cache-Control: no-store`.
- Unsafe browser methods require the approved `Origin`. Staff/admin writes also retain the Lab 3 CSRF control.
- Unknown fields, duplicate query keys, malformed IDs, invalid enums, and non-integer revisions are rejected rather than ignored.
- Errors use `{ "error": { "code": string, "message": string, "fieldErrors"?: object, "requestId": string } }`. A safe `500 INTERNAL_ERROR` contains no implementation detail.
- Resource ownership failures may return safe `404`; role failures return `403`; stale/invalid state returns `409`.

## 2. Schemas

```ts
type ActionStatus = "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

type UserSummary = { id: number; displayName: string; role: "IT_STAFF" | "ADMINISTRATOR" };

type ActionTaken = {
  id: number; ticketId: number; description: string; result: string | null;
  status: ActionStatus; recordedBy: UserSummary; performedBy: UserSummary | null;
  assignee: UserSummary; workflowCycle: number;
  followUpRequired: boolean; followUpNote: string | null;
  attachmentNotes: string | null; revision: number;
  createdAt: string; updatedAt: string; completedAt: string | null;
};

type ActionSummary = Pick<ActionTaken,
  "id" | "ticketId" | "description" | "status" | "assignee" | "revision" | "updatedAt"> & {
  ticketNumber: string; ticketSummary: string;
  attribution: ("RECORDED" | "ASSIGNED" | "PERFORMED")[];
};

type TicketSummary = {
  id: number; ticketNumber: string; summary: string; status: string;
  itPriority: "LOW" | "MEDIUM" | "HIGH"; owner: UserSummary | null;
  version: number; resolvedAt: string | null; updatedAt: string;
};
```

Text length is counted in Unicode code points after trim. Description/Result use 1–2,000; Follow-up Note/Attachment Notes use 1–1,000.

## 3. Actions Taken

### 3.1 List Actions

```http
GET /api/staff/tickets/:id/actions
GET /api/tickets/:id/actions
```

The staff path permits IT Staff/Administrator. The requester path performs an owned-Ticket lookup. Response: `200 { "items": ActionTaken[] }`, ordered `createdAt ASC, id ASC`. Requesters receive the same shared Action fields, with no audit-only changed-field data. Missing/inaccessible resources use safe `404`.

### 3.2 Create Action

```http
POST /api/staff/tickets/:id/actions
```

```json
{
  "clientRequestId": "52f36ab9-85b0-48ee-a60b-3c31e9f741ee",
  "expectedTicketVersion": 4,
  "description": "Inspect and replace the damaged network cable.",
  "result": null,
  "assigneeId": 12,
  "followUpRequired": true,
  "followUpNote": "Verify connectivity tomorrow.",
  "attachmentNotes": "See cable-photo.jpg on the Ticket."
}
```

The initial status is `PLANNED`; `recordedBy` and timestamps come from the session/backend. First success returns `201 { action, replayed:false }` and `Location`; an exact retry for the same Ticket/request ID returns `200 { action, replayed:true }` even though that success advanced the Ticket version. The idempotency fingerprint excludes `expectedTicketVersion`. Reusing the key with different normalized Action content returns `409 IDEMPOTENCY_CONFLICT`. A new create checks `expectedTicketVersion` after locking the parent and returns `409 STALE_TICKET` on mismatch.

### 3.3 Update Action content/assignment

```http
PATCH /api/staff/tickets/:ticketId/actions/:actionId
```

Body contains `expectedTicketVersion`, `revision`, and one or more of `description`, `result`, `assigneeId`, `followUpRequired`, `followUpNote`, `attachmentNotes`. Status changes are not accepted here. Only non-terminal Actions on actionable Tickets (`NEW`, `OPEN`, `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, `REOPENED`) can be edited. Success returns `200 ActionTaken`. A non-actionable Ticket returns `409 TICKET_NOT_ACTIONABLE`; a parent version mismatch returns `409 STALE_TICKET`; an Action revision mismatch returns `409 STALE_ACTION`. Ineligible assignee returns `409 INVALID_ACTION_ASSIGNEE`. The Action update, one parent version increment, and append-only event are committed atomically.

### 3.4 Transition Action

```http
PATCH /api/staff/tickets/:ticketId/actions/:actionId/status
```

```json
{ "status": "COMPLETED", "expectedTicketVersion": 5, "revision": 3, "result": "Cable replaced; link stable." }
```

`result` is accepted here to complete atomically. Completion requires a non-empty Result and `followUpRequired=false`; staff cancellation also requires `followUpRequired=false`. On completion, the authenticated actor becomes `performedBy` and the server sets `completedAt`. Success returns `200 ActionTaken`. A terminal Action cannot transition or be edited; create another Action for later work. Invalid transition returns `409 INVALID_ACTION_TRANSITION`; missing Result or uncleared follow-up returns `400 VALIDATION_ERROR`; a non-actionable Ticket returns `409 TICKET_NOT_ACTIONABLE`; stale parent/Action tokens return `409 STALE_TICKET`/`STALE_ACTION`. Ticket-level cancellation may system-cancel active Actions while retaining their follow-up fields as historical data. No delete endpoint exists.

### 3.5 List Action audit events

```http
GET /api/staff/tickets/:ticketId/actions/:actionId/events
```

Staff/Admin only. Returns bounded Action event metadata in `createdAt ASC, id ASC`. Events cannot be created, updated, or deleted directly. Requester Action responses do not expose changed-field history.

## 4. Ticket Workflow Extension

```http
PATCH /api/staff/tickets/:id/status
```

Lab 4 request body is `{ "status": <TicketStatus>, "expectedTicketVersion": <positive integer> }`. Existing transition rules remain. `RESOLVED` additionally requires current-cycle completed work with Result, no `PLANNED`/`IN_PROGRESS` Actions, and no Action with `followUpRequired=true`; failure returns `409 RESOLUTION_GATE_NOT_MET` with safe reason codes. A version mismatch returns `409 STALE_TICKET`. Resolution validation and update share one transaction. Reopening increments `workflowCycle` and clears `resolvedAt`; resolving sets `resolvedAt`, which closing preserves. Requester advisory route remains unchanged and cannot formally resolve a Ticket.

## 5. Requester Dashboard

```http
GET /api/dashboard/requester
```

Requester only; identity always comes from the session.

```json
{
  "metrics": { "openCount": 3, "waitingForRequesterCount": 1 },
  "recentlyUpdated": [],
  "recentlyResolved": [],
  "recentlyResolvedWindow": {
    "from": "2026-09-18T00:00:00.000Z",
    "before": "2026-09-25T00:00:00.000Z"
  },
  "generatedAt": "2026-09-25T00:00:00.000Z"
}
```

Lists contain at most five `TicketSummary` items. `generatedAt` is captured once; `recentlyResolvedWindow.from` is exactly 168 hours before it and `before` equals `generatedAt`. The list predicate is `status IN (RESOLVED,CLOSED) AND resolvedAt >= from AND resolvedAt < before`, scoped by authenticated requester, ordered `resolvedAt DESC, id DESC`. A legacy row with unknown `resolvedAt` is not backfilled or included. Zero state uses numeric zero and empty arrays.

The existing authenticated My Tickets API is `GET /api/tickets`. It accepts one `statusIn` query parameter containing comma-separated, uppercase Ticket statuses with no whitespace or duplicates; the canonical open filter is `statusIn=NEW,OPEN,IN_PROGRESS,WAITING_FOR_REQUESTER,REOPENED`. A single status can continue to use `status`. Supplying both `status` and `statusIn`, repeating either query key, an empty member, duplicate/unknown status, or whitespace returns `400 VALIDATION_ERROR`. Recently Resolved drill-down uses `statusIn=RESOLVED,CLOSED&resolvedFrom=<from>&resolvedBefore=<before>` with the exact dashboard bounds; the two date parameters must appear together, be canonical UTC ISO timestamps, and satisfy `resolvedFrom < resolvedBefore`. Date bounds without exactly `statusIn=RESOLVED,CLOSED` are invalid. Dashboard links preserve these values; detail items use `/tickets/:id`.

## 6. Staff Dashboard

```http
GET /api/staff/dashboard
```

IT Staff/Administrator only.

```json
{
  "metrics": {
    "unassignedOpenCount": 2,
    "ownedByMeOpenCount": 4,
    "byStatus": { "NEW": 1, "OPEN": 2, "IN_PROGRESS": 1, "WAITING_FOR_REQUESTER": 1, "RESOLVED": 1, "CLOSED": 3, "REOPENED": 0, "CANCELLED": 1 },
    "byItPriority": { "LOW": 2, "MEDIUM": 4, "HIGH": 3 }
  },
  "myActions": [], "recentlyUpdated": [], "urgentTickets": [],
  "generatedAt": "2026-09-25T00:00:00.000Z"
}
```

Each list is bounded to five summaries. Counts follow BR-26 and BR-28. `myActions` is the deduplicated union of Actions recorded by, assigned to, or performed by the authenticated staff user; each summary includes `attribution: ("RECORDED"|"ASSIGNED"|"PERFORMED")[]` with all matching roles. Drill-down uses existing Queue parameters (`ownerId=unassigned`, `ownerId=me`, `status`, `itPriority`) or `/staff/tickets/:id`. The Queue contract must add the literal `me` if not already supported before dashboard drill-down is considered complete.

## 7. Assignee Reference Data

Existing `GET /api/staff/assignees` remains the source for active eligible users. Action writes re-check eligibility transactionally; a previously loaded option is not proof of eligibility.

## 8. Authorization and Error Precedence

Authentication and forced-password rules run before resource lookup. Role checks run before staff/admin handler execution. Valid-role handlers then validate path/body and resolve resource/ownership. Expected codes include `VALIDATION_ERROR`, `FORBIDDEN`, `NOT_FOUND`, `INVALID_ACTION_ASSIGNEE`, `INVALID_ACTION_TRANSITION`, `RESOLUTION_GATE_NOT_MET`, `STALE_ACTION`, `STALE_TICKET`, `IDEMPOTENCY_CONFLICT`, and safe `INTERNAL_ERROR`.

## 9. Concurrency and Duplicate Handling

Action writes use optimistic Action revision and parent Ticket version checks. Every Action write and Ticket status transition begins a transaction, locks the parent Ticket row first, then the Action row if present, and rechecks parent status/cycle, version, Action revision, authorization, assignee eligibility, and the resolution predicate under lock. Competing child writes and resolution/cancellation therefore serialize: if the child write wins, the gate sees it; if the terminal Ticket transition wins, the child write rechecks and is rejected. A successful Action mutation, parent `version=version+1`, and one event insert commit atomically. The conditional Ticket write predicate is `id=:id AND version=:expectedTicketVersion`; no timestamp participates in concurrency. Missing `expectedTicketVersion` on a Lab 4 write returns `400 VALIDATION_ERROR`; Lab 4 clients must be upgraded together, while additive `version` response fields do not break Lab 3 readers. Action creation uses `(ticketId, clientRequestId)` uniqueness and a canonical request fingerprint. Assignment eligibility changes reuse the Lab 3 transaction/advisory-lock protocol so an active Action never finishes assigned to an ineligible user.

## 10. Health and Regression

`GET /api/health` remains public and unchanged. All approved Lab 2/3 routes retain their shapes unless this document explicitly extends them. Dashboard queries must be bounded and covered by performance smoke tests against the documented seed dataset.
