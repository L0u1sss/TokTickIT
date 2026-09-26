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
  status: ActionStatus; performedBy: UserSummary; assignee: UserSummary;
  followUpRequired: boolean; followUpNote: string | null;
  attachmentNotes: string | null; revision: number;
  createdAt: string; updatedAt: string; completedAt: string | null;
};

type ActionSummary = Pick<ActionTaken,
  "id" | "ticketId" | "description" | "status" | "assignee" | "revision" | "updatedAt"> & {
  ticketNumber: string; ticketSummary: string;
};

type TicketSummary = {
  id: number; ticketNumber: string; summary: string; status: string;
  itPriority: "LOW" | "MEDIUM" | "HIGH"; owner: UserSummary | null; updatedAt: string;
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
  "description": "Inspect and replace the damaged network cable.",
  "result": null,
  "assigneeId": 12,
  "followUpRequired": true,
  "followUpNote": "Verify connectivity tomorrow.",
  "attachmentNotes": "See cable-photo.jpg on the Ticket."
}
```

The initial status is `PLANNED`; `performedBy` and timestamps come from the session/backend. First success returns `201 { action, replayed:false }` and `Location`; an exact retry for the same Ticket/request ID returns `200 { action, replayed:true }`. Reusing the key with different normalized content returns `409 IDEMPOTENCY_CONFLICT`.

An individual Action can be retrieved with either role-appropriate path:

```http
GET /api/staff/tickets/:ticketId/actions/:actionId
GET /api/tickets/:ticketId/actions/:actionId
```

The requester route performs the same owned-Ticket check as the requester list route. An Action that does not belong to the path Ticket returns safe `404 NOT_FOUND`.

### 3.3 Update Action content/assignment

```http
PATCH /api/staff/tickets/:ticketId/actions/:actionId
```

Body contains `revision` and one or more of `description`, `result`, `assigneeId`, `followUpRequired`, `followUpNote`, `attachmentNotes`. Status changes are not accepted here. Success returns `200 ActionTaken`. A revision mismatch returns `409 STALE_ACTION`. Ineligible assignee returns `409 INVALID_ACTION_ASSIGNEE`. The update and append-only event are committed atomically.

### 3.4 Transition Action

```http
PATCH /api/staff/tickets/:ticketId/actions/:actionId/status
```

```json
{ "status": "COMPLETED", "revision": 3, "result": "Cable replaced; link stable." }
```

`result` is accepted here to complete atomically. Success returns `200 ActionTaken`. Invalid transition returns `409 INVALID_ACTION_TRANSITION`; missing completion Result returns `400 VALIDATION_ERROR`; stale revision returns `409 STALE_ACTION`. No delete endpoint exists.

### 3.5 List Action audit events

```http
GET /api/staff/tickets/:ticketId/actions/:actionId/events
```

Staff/Admin only. Returns bounded Action event metadata in `createdAt ASC, id ASC`. Events cannot be created, updated, or deleted directly. Requester Action responses do not expose changed-field history.

## 4. Ticket Workflow Extension

```http
PATCH /api/staff/tickets/:id/status
```

Lab 4 request body is `{ "status": <TicketStatus>, "expectedUpdatedAt": <ISO timestamp> }`. Existing transition rules remain. `RESOLVED` additionally requires a completed Action with Result; failure returns `409 RESOLUTION_GATE_NOT_MET`. A stale timestamp returns `409 STALE_TICKET`. Resolution validation and update share one transaction. Requester advisory route remains unchanged and cannot formally resolve a Ticket.

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
  "generatedAt": "2026-09-25T00:00:00.000Z"
}
```

Lists contain at most five `TicketSummary` items. Counts/list definitions follow BR-26–BR-27. Zero state uses numeric zero and empty arrays. Drill-down links are constructed by the client from documented My Tickets queries: open statuses use `status=OPEN_GROUP`, waiting uses `status=WAITING_FOR_REQUESTER`; detail items use `/tickets/:id`.

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

Each list is bounded to five summaries. Counts follow BR-26 and BR-28. Drill-down uses existing Queue parameters (`ownerId=unassigned`, `ownerId=me`, `status`, `itPriority`) or `/staff/tickets/:id`. The Queue contract must add the literal `me` if not already supported before dashboard drill-down is considered complete.

## 7. Assignee Reference Data

Existing `GET /api/staff/assignees` remains the source for active eligible users. Action writes re-check eligibility transactionally; a previously loaded option is not proof of eligibility.

## 8. Authorization and Error Precedence

Authentication and forced-password rules run before resource lookup. Role checks run before staff/admin handler execution. Valid-role handlers then validate path/body and resolve resource/ownership. Expected codes include `VALIDATION_ERROR`, `FORBIDDEN`, `NOT_FOUND`, `INVALID_ACTION_ASSIGNEE`, `INVALID_ACTION_TRANSITION`, `RESOLUTION_GATE_NOT_MET`, `STALE_ACTION`, `STALE_TICKET`, `IDEMPOTENCY_CONFLICT`, and safe `INTERNAL_ERROR`.

## 9. Concurrency and Duplicate Handling

Action writes use optimistic revision checks and atomic event insertion. Ticket workflow uses expected `updatedAt`. Action creation uses `(ticketId, clientRequestId)` uniqueness and a canonical request fingerprint. Assignment eligibility changes reuse the Lab 3 transaction/advisory-lock protocol so an active Action never finishes assigned to an ineligible user.

## 10. Health and Regression

`GET /api/health` remains public and unchanged. All approved Lab 2/3 routes retain their shapes unless this document explicitly extends them. Dashboard queries must be bounded and covered by performance smoke tests against the documented seed dataset.
