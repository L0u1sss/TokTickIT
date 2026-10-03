# TokTickIT Lab 4 — REST API Contract

> Implemented contract through Issue #60, originating in Issue #52. Paths extend the Lab 3 API. Lab 4 explicitly changes claim, owner, IT Priority, status, and Action write payloads to require `expectedTicketVersion`; other unchanged Lab 1–3 routes retain their prior contract. Final release evidence is tracked in Issue #61.

## 1. Conventions

- JSON uses UTF-8 and ISO 8601 UTC timestamps. IDs are positive base-10 integers.
- All routes except `/api/health` and authentication require the existing `toktickit_session`; responses use `Cache-Control: no-store`.
- Unsafe browser methods require the approved `Origin`. Staff/admin writes also retain the Lab 3 CSRF control.
- Unknown fields, duplicate query keys, malformed IDs, invalid enums, and non-integer revisions are rejected rather than ignored.
- Errors use `{ "error": { "code": string, "message": string, "details"?: { "field": string, "issue": string }[], "fieldErrors"?: Record<string,string>, "requestId": string } }`. When details are present, middleware also derives `fieldErrors` for field-level feedback; consumers use `details` for multiple issues on the same field. A safe `500 INTERNAL_ERROR` contains no implementation detail.
- Resource ownership failures may return safe `404`; role failures return `403`; stale/invalid state returns `409`.

## 2. Schemas

```ts
type ActionStatus = "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

type UserSummary = { id: number; displayName: string; role: "REQUESTER" | "IT_STAFF" | "ADMINISTRATOR" };

type ActionTaken = {
  id: number; ticketId: number; description: string; result: string | null;
  status: ActionStatus; recordedBy: UserSummary; performedBy: UserSummary | null;
  assignee: UserSummary; workflowCycle: number;
  cancelledAt: string | null; cancelledBy: UserSummary | null;
  cancellationSource: "STAFF_ACTION" | "TICKET_CASCADE" | null;
  followUpRequired: boolean; followUpNote: string | null;
  attachmentNotes: string | null; revision: number;
  createdAt: string; updatedAt: string; completedAt: string | null;
};

type ActionSummary = Pick<ActionTaken,
  "id" | "ticketId" | "description" | "status" | "assignee" | "revision" | "updatedAt"> & {
  ticketNumber: string; ticketSummary: string;
  attribution: ("RECORDED" | "ASSIGNED" | "PERFORMED")[];
};

type ActionEvent = {
  id: number; actor: UserSummary;
  eventType: "ACTION_CREATED" | "ACTION_UPDATED" | "ACTION_COMPLETED" | "ACTION_CANCELLED" | "TICKET_CASCADE_CANCELLED";
  fromStatus: ActionStatus | null; toStatus: ActionStatus | null;
  changedFields: { fields: string[] }; revision: number; createdAt: string;
};

type StaffTicketSummary = {
  id: number; ticketNumber: string; summary: string; status: string;
  itPriority: "LOW" | "MEDIUM" | "HIGH"; owner: UserSummary | null;
  version: number; resolvedAt: string | null; updatedAt: string;
};
```

Requester dashboard/list summaries have the existing requester-safe shape: `id`, `version`, `ticketNumber`, `summary`, public display `status`, `requestedPriority`, category/system `{ id, name }`, `activeAttachmentCount`, `createdAt`, `updatedAt`, and nullable `resolvedAt`. They exclude description, requester identity, staff ownership, notes, and attachment storage keys. Staff dashboard summaries use `StaffTicketSummary` above.

`UserSummary.role` is the user's current role. Historical Action participants
remain referenced after permitted account changes, so a terminal Action can
display a former staff member whose current role is Requester. New/current
Action assignment still requires active IT Staff or Administrator eligibility
under BR-08–BR-09; historical read data grants no write permission.

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

The initial status is `PLANNED`; `recordedBy` and timestamps come from the session/backend, and `performedBy` is null until completion. Cancellation provenance fields are initially null. First success returns `201 { action, replayed:false, ticketVersion }` and `Location`; an exact retry for the same Ticket/request ID returns `200 { action, replayed:true, ticketVersion }` even though that success advanced the Ticket version. `ticketVersion` is the current parent version after the operation (or current version on replay) and is the token for the next Ticket/Action write. The fingerprint of normalized original create intent, including authenticated recorder but excluding `expectedTicketVersion`, is retained in the immutable `ActionTaken.createFingerprint` column and is not compared to the mutable current Action projection. Every audit event keeps `changedFields` in the `{ fields: string[] }` shape. Reusing the key with different normalized Action content returns `409 IDEMPOTENCY_CONFLICT`. A new create checks `expectedTicketVersion` after locking the parent and returns `409 STALE_TICKET` on mismatch.

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

Body contains `expectedTicketVersion`, `revision`, and one or more of `description`, `result`, `assigneeId`, `followUpRequired`, `followUpNote`, `attachmentNotes`. Status changes are not accepted here. Only non-terminal Actions on actionable Tickets (`NEW`, `OPEN`, `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, `REOPENED`) can be edited. Success returns `200 { action: ActionTaken, ticketVersion }`; `ticketVersion` is the incremented parent version and must be used for the next write. A non-actionable Ticket returns `409 TICKET_NOT_ACTIONABLE`; a parent version mismatch returns `409 STALE_TICKET`; an Action revision mismatch returns `409 STALE_ACTION`. Ineligible assignee returns `409 INVALID_ACTION_ASSIGNEE`. The Action update, one parent version increment, and append-only event are committed atomically. Explicit no-op edits return the current versions without writing.

### 3.4 Transition Action

```http
PATCH /api/staff/tickets/:ticketId/actions/:actionId/status
```

```json
{ "status": "COMPLETED", "expectedTicketVersion": 5, "revision": 3, "result": "Cable replaced; link stable." }
```

`result` is accepted here to complete atomically. Completion requires a non-empty Result, `followUpRequired=false`, and the authenticated actor to be the current Action assignee. The server locks the parent Ticket, then the Action row, re-reads `assigneeId`, and checks actor identity while holding both locks before copying the assignee into `performedBy` and setting `completedAt`. The append-only Action event records the authenticated actor. A non-assignee receives `403 ACTION_ASSIGNEE_REQUIRED`. Staff cancellation also requires `followUpRequired=false`; it sets `cancelledAt`, `cancelledBy`, and `cancellationSource=STAFF_ACTION`. Success returns `200 { action: ActionTaken, ticketVersion }`; use the returned parent version for the next write. A terminal Action cannot transition or be edited; create another Action for later work. Invalid transition returns `409 INVALID_ACTION_TRANSITION`; missing Result or uncleared follow-up returns `400 VALIDATION_ERROR`; a non-actionable Ticket returns `409 TICKET_NOT_ACTIONABLE`; stale parent/Action tokens return `409 STALE_TICKET`/`STALE_ACTION`. Ticket-level cancellation may system-cancel active Actions while retaining their follow-up fields as historical data. No delete endpoint exists.

### 3.5 List Action audit events

```http
GET /api/staff/tickets/:ticketId/actions/:actionId/events
```

Staff/Admin only. Returns `200 { "items": ActionEvent[] }` with all events for the selected Action in `createdAt ASC, id ASC`; this endpoint currently has no pagination or row limit. The path identifies the Action, and each event includes event type, authenticated actor, Action revision, and event time without repeating `actionId`. `changedFields` is exactly `{ "fields": string[] }` with at least one non-empty field name. `ACTION_UPDATED` includes non-terminal status transitions such as `PLANNED → IN_PROGRESS`; completion/cancellation use their dedicated event types. Manual cancellation uses `ACTION_CANCELLED`; Ticket cascade cancellation uses `TICKET_CASCADE_CANCELLED`. Events cannot be created, updated, or deleted through the API; the database rejects updates, deletes, and truncation. Requester Action responses do not expose changed-field history.

## 4. Ticket Workflow Extension

All Ticket aggregate writes use the same optimistic concurrency contract. The client sends the `version` returned by Ticket Detail/dashboard summaries as `expectedTicketVersion`; missing or non-positive values return `400 VALIDATION_ERROR`, and a stale value returns `409 STALE_TICKET` without mutation. Each accepted command conditionally increments the Ticket version exactly once and returns the new `version` and `updatedAt`. This extends the Lab 3 write contract; all Lab 4 clients must be upgraded together.

### 4.1 Claim Ticket

```http
POST /api/staff/tickets/:id/claim
```

Body: `{ "expectedTicketVersion": 5 }`. The authenticated eligible staff user becomes owner only if the Ticket is still unowned and assignable. Success returns `{ "owner": UserSummary, "version": 6, "updatedAt": "..." }`. A stale token returns `409 STALE_TICKET`; existing already-owned/not-assignable conflicts remain unchanged.

### 4.2 Assign or reassign owner

```http
PATCH /api/staff/tickets/:id/owner
```

Body: `{ "ownerId": 12, "expectedTicketVersion": 5 }`. The server validates eligibility and conditionally writes owner plus `version=version+1`. Success returns `{ "owner": UserSummary, "version": 6, "updatedAt": "..." }`; stale token returns `409 STALE_TICKET`.

### 4.3 Update IT Priority

```http
PATCH /api/staff/tickets/:id/it-priority
```

Body: `{ "itPriority": "HIGH", "expectedTicketVersion": 5 }`. Success returns `{ "itPriority": "HIGH", "version": 6, "updatedAt": "..." }`; stale token returns `409 STALE_TICKET`.

### 4.4 Transition Ticket status

```http
PATCH /api/staff/tickets/:id/status
```

Body: `{ "status": <TicketStatus>, "expectedTicketVersion": <positive integer> }`. Existing transition rules remain. `RESOLVED` additionally requires current-cycle completed work with Result, no `PLANNED`/`IN_PROGRESS` Actions, and no non-cancelled Action with `followUpRequired=true`; cancelled follow-up is historical-only. Failure returns `409 RESOLUTION_GATE_NOT_MET` with `error.details` entries `{ "field": "actions", "issue": <reason> }`, using `MISSING_COMPLETED_WORK`, `ACTIVE_ACTIONS`, and `OUTSTANDING_FOLLOW_UP`. Multiple failed conditions are returned together. Success returns `{ "status": <TicketStatus>, "version": <new integer>, "updatedAt": "..." }`. Resolution validation and conditional update share one transaction. For Ticket cancellation, each current-cycle `PLANNED`/`IN_PROGRESS` Action is changed to `CANCELLED` atomically: increment its revision exactly once, set Action `updatedAt` and `cancelledAt` to the same UTC transaction timestamp as the Ticket, set `cancelledBy` to the authenticated Ticket-cancellation actor, set source `TICKET_CASCADE`, preserve follow-up fields as historical-only, and append one `TICKET_CASCADE_CANCELLED` event at that revision with that actor and timestamp. Old Action revision tokens then fail with `409 STALE_ACTION`. The parent Ticket version increments once for the aggregate cancellation. Reopening increments `workflowCycle` and clears `resolvedAt`; resolving sets `resolvedAt`, which closing preserves. Requester advisory route remains unchanged and cannot formally resolve a Ticket.

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

Lists contain at most five `TicketSummary` items. Counts/list definitions follow BR-26–BR-27. Zero state uses numeric zero and empty arrays. Drill-down links are constructed by the client from documented My Tickets queries: open statuses use `status=OPEN_GROUP`, waiting uses `status=WAITING_FOR_REQUESTER`; recently resolved uses `statusIn=RESOLVED,CLOSED&resolvedFrom=<from>&resolvedBefore=<before>` with the exact response window URL-encoded; detail items use `/tickets/:id`.

Requester `recentlyUpdated` intentionally has **no time cutoff**: it returns the latest five owned Tickets across all current statuses and all dates, ordered `updatedAt DESC, id DESC`. An older Ticket remains eligible when there are fewer than five newer ones. UTC timestamps and BR-43 mutation semantics apply; only Recently Resolved uses the rolling 168-hour date boundary. The name denotes relative ordering, not a seven-day filter.

`recentlyResolved` filters current `RESOLVED`/`CLOSED` Tickets with `resolvedAt >= from AND resolvedAt < before` and orders `resolvedAt DESC, id DESC`. The window is 168 hours ending at the one `generatedAt` captured before all queries. Legacy null resolution times, older resolutions, upper-bound/future timestamps, and reopened Tickets are excluded. Metrics and lists share a repeatable-read transaction.

My Tickets accepts either `status` (`New`, `OPEN_GROUP`, `WAITING_FOR_REQUESTER`) or `statusIn` (a comma-separated, nonempty, duplicate-free list of the eight exact Ticket status codes). Combining them returns `400 INVALID_QUERY`. `resolvedFrom`/`resolvedBefore` must be supplied together as valid canonical ISO 8601 UTC timestamps (`YYYY-MM-DDTHH:mm:ss.sssZ`), with `from < before`, and only `RESOLVED`/`CLOSED` selected. Unknown, repeated, invalid, or contradictory parameters return `400 INVALID_QUERY`. Every list/count still uses authenticated ownership. Existing sorting/paging is preserved; changing the Status control clears the resolution bounds.

The dashboard itself accepts no query parameters (`400 INVALID_QUERY`); unauthenticated requests return `401`, Staff/Admin return `403`, and unexpected failures return the safe `500 INTERNAL_ERROR` envelope.

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

The response key `urgentTickets` is retained for compatibility and denotes **High Priority Tickets**, the exact predicate `itPriority=HIGH` across all Ticket statuses. The UI heading is "High Priority Tickets". This preview is ordered `updatedAt ASC, id ASC`, limited to five rows, and uses the same priority predicate as `metrics.byItPriority.HIGH` and `/staff/tickets?itPriority=HIGH`. It includes resolved/terminal HIGH Tickets; it does not introduce CRITICAL, SLA or another urgency classification.

Staff `generatedAt` is captured once before starting the repeatable-read transaction, matching the Requester capture pattern. The returned UTC ISO 8601 value remains fixed during delayed query execution and is displayed as Last refreshed. It denotes request capture time, not query completion or a PostgreSQL snapshot timestamp; all metric/list reads share the repeatable-read database snapshot. Staff metrics use no calendar-day cutoff.

Each list is bounded to five summaries. `recentlyUpdated` uses Ticket `updatedAt` as defined in BR-43, so accepted Action aggregate mutations appear in the preview. Counts follow BR-26 and BR-28. `myActions` is the deduplicated union of Actions recorded by, assigned to, or performed by the authenticated staff user; each summary includes `attribution: ("RECORDED"|"ASSIGNED"|"PERFORMED")[]` with all matching roles. Drill-down uses existing Queue parameters (`ownerId=unassigned`, `ownerId=me`, `status`, `itPriority`) or `/staff/tickets/:id`. Queue supports `ownerId=me` from the authenticated session and `status=OPEN_GROUP` mapping to `NEW`, `OPEN`, `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, and `REOPENED`. Unassigned Open uses `/staff/tickets?ownerId=unassigned&status=OPEN_GROUP`; Owned by Me uses `/staff/tickets?ownerId=me&status=OPEN_GROUP`. Action summaries link to `/staff/tickets/:id#actions`. All My Actions statuses, including immutable terminal history, remain eligible under BR-28; membership is the union of attribution roles, rather than only active assignments. Each matching role appears once, and raw recorder/performer IDs and complete Action details are excluded from the summary. Dashboard queries reject all query parameters, derive identity exclusively from the session, and use a repeatable-read transaction for a consistent aggregate/list snapshot.

## 7. Assignee Reference Data

Existing `GET /api/staff/assignees` remains the source for active eligible users. Action writes re-check eligibility transactionally; a previously loaded option is not proof of eligibility.

## 8. Authorization and Error Precedence

Authentication and forced-password rules run before resource lookup. Role checks run before staff/admin handler execution. Valid-role handlers then validate path/body and resolve resource/ownership. Expected codes include `VALIDATION_ERROR`, `FORBIDDEN`, `NOT_FOUND`, `ACTION_ASSIGNEE_REQUIRED`, `INVALID_ACTION_ASSIGNEE`, `INVALID_ACTION_TRANSITION`, `RESOLUTION_GATE_NOT_MET`, `STALE_ACTION`, `STALE_TICKET`, `IDEMPOTENCY_CONFLICT`, and safe `INTERNAL_ERROR`.

## 9. Concurrency and Duplicate Handling

Every Ticket aggregate write (claim, owner assignment/reassignment, priority, status, and Action mutation) uses the same parent lock and compare-and-swap predicate `id=:id AND version=:expectedTicketVersion`. The transaction increments version once and sets parent `updatedAt` to its transaction timestamp on success; stale concurrent owner/priority/status/Action writes return `409 STALE_TICKET`. Action writes additionally check Action `revision`. The parent Ticket row is locked before the Action row. Action writes requiring an eligible assignee then lock that User row and recheck eligibility; they do not take the user-management advisory lock. Account management takes advisory then User row locks; Ticket owner assignment takes Ticket then advisory lock. Account management never takes Ticket or Action row locks, preventing a lock-order cycle with Action writes. For completion, re-read the Action assignee after acquiring the Action row lock and compare it to the authenticated actor inside the transaction. Reassignment and completion serialize: if reassignment commits first, the old assignee cannot complete; if completion commits first, the terminal Action cannot be reassigned. The transaction also rechecks parent status/cycle, authorization, assignee eligibility, and resolution predicate. Competing child writes and resolution/cancellation serialize: if a child write wins, the gate sees it; if the terminal Ticket transition wins, the child write rechecks and is rejected. Action projection, one parent version increment, and one event insert commit atomically; the event revision equals the incremented projection revision, preserving the contiguous sequence. PostgreSQL guarantees event revision positivity/uniqueness, while this cross-row agreement and monotonicity are API transaction responsibilities tested in the Action API suite. Comments, Internal Notes, and attachment child-resource writes retain their Lab 3 contract and do not increment the Ticket version or change Ticket `updatedAt` unless they also mutate a Ticket aggregate field. No timestamp participates in concurrency. Missing `expectedTicketVersion` on a Lab 4 aggregate write returns `400 VALIDATION_ERROR`; Lab 4 clients must be upgraded together, while additive `version` response fields do not break Lab 3 readers. Action creation uses `(ticketId, clientRequestId)` uniqueness and a canonical request fingerprint.

## 10. Health and Regression

`GET /api/health` remains public and unchanged. All approved Lab 2/3 routes retain their shapes unless this document explicitly extends them. Dashboard queries must be bounded and covered by performance smoke tests against the documented seed dataset.
