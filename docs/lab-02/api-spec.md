# TokTickIT Lab 2 REST API Contract

**Issue:** 1 - Sprint Engineering Specification, UI Tokens, and Test Plan Documentation

**Contract version:** 1.0

**Status:** Implementation target for Lab 2; no application code is defined here

This document is the normative HTTP contract for the requester-facing ticket MVP. It covers simulated requester context, ticket creation and retrieval, requester-scoped listing, and attachment lifecycle operations. Authentication, IT Staff operations, public comments, and ticket status transitions are outside this contract.

## 1. Contract Conventions

### 1.1 Base path, media types, and naming

- All routes are relative to the same origin and begin with `/api`.
- JSON request bodies use `Content-Type: application/json`.
- JSON responses use `Content-Type: application/json; charset=utf-8`.
- Attachment uploads are the only non-JSON requests; they use `multipart/form-data` with a generated boundary.
- Attachment downloads are binary responses with the stored media type.
- JSON property names are `camelCase`.
- Resource IDs are positive decimal integers. JSON IDs are numbers; path and query IDs are their base-10 string representation without signs or decimals.
- Date-time values are UTC RFC 3339 strings, for example `2026-08-20T07:15:30.000Z`.
- Text length limits count Unicode characters after leading and trailing whitespace is removed. The API stores the trimmed value.
- Unless a schema says otherwise, every listed property is required and request bodies reject unknown properties.
- Successful responses return the resource or collection directly, except `POST /api/tickets`, which returns the `TicketCreateResult` envelope so a caller can distinguish a first creation from an idempotent replay.

### 1.2 Simulated requester context

`x-requester-id` is a temporary, Lab 2-only requester selector. It supplies request context; it is **not authentication** and must not be represented as secure identity verification.

| Rule | Contract |
|---|---|
| Header value | Exactly one positive decimal integer, such as `12` |
| Required on | All ticket and attachment endpoints |
| Not required on | `GET /api/requesters` and `GET /api/metadata` |
| Missing, blank, malformed, zero/negative, or repeated header | `400 INVALID_REQUESTER_CONTEXT` |
| ID for an unknown or inactive requester | `400 INVALID_REQUESTER_CONTEXT` |
| Ownership source on create | The validated header only; clients cannot submit or override `requesterId` in JSON |
| Scope on reads/writes | The ticket's `requesterId` must equal the validated header value |

The client obtains selectable IDs from `GET /api/requesters`, which returns active requesters only. Protected endpoints validate the header on every request; a previously selected requester that has since become inactive is rejected.

### 1.3 Ownership and lookup order

For any endpoint containing `:id`, the API applies this order consistently:

1. Validate `x-requester-id` and path/query/body syntax.
2. Load the ticket identified by `:id` without silently applying an owner filter.
3. Return `404 TICKET_NOT_FOUND` if that ticket does not exist.
4. Return `403 TICKET_FORBIDDEN` if it exists but belongs to another requester.
5. For attachment routes, resolve `:attId` within that ticket; return `404 ATTACHMENT_NOT_FOUND` if it does not exist or belongs to a different ticket, even when that attachment ID exists under another ticket.

This rule makes `403` behavior testable while ensuring another requester can never read ticket content, attachment metadata, or file bytes, or mutate the ticket's attachments. A foreign parent ticket is rejected with `403 TICKET_FORBIDDEN` before child lookup; a wrong-ticket nested attachment under an owned parent is rejected with `404 ATTACHMENT_NOT_FOUND`.

### 1.4 Error response schema

Every defined `400`, `403`, `404`, `409`, and pre-stream `500` response uses this JSON shape:

| Property | Type | Required | Meaning |
|---|---:|:---:|---|
| `error` | object | yes | Error envelope |
| `error.code` | string | yes | Stable, machine-readable code from this document |
| `error.message` | string | yes | Safe, human-readable message |
| `error.details` | array | no | One or more field-specific validation problems |
| `error.details[].field` | string | yes | Header, path, query, form, or JSON field name |
| `error.details[].issue` | string | yes | Safe explanation of the failed rule |

Example validation error:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request contains invalid fields.",
    "details": [
      {
        "field": "summary",
        "issue": "Must contain 5 to 120 characters after trimming."
      }
    ]
  }
}
```

Example ownership error:

```json
{
  "error": {
    "code": "TICKET_FORBIDDEN",
    "message": "The selected requester does not own this ticket."
  }
}
```

Example unexpected-failure response:

```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "The request could not be completed."
  }
}
```

`500 INTERNAL_ERROR` is the defined outcome for an unexpected server, database, or storage failure. Its message is deliberately safe and non-diagnostic, and it never includes `error.details`. Logs and responses must never expose stack traces, SQL or ORM details, credentials, filesystem paths, generated storage names, or database connection information. Endpoint sections may provide a safe operation-specific message without changing the code or envelope.

The application outcomes in this Lab 2 contract are `200`, `201`, `400`, `403`, `404`, `409`, and `500`. The simulated context does not use `401`; validation does not use `409` or `422`; `409` is reserved for conflicting `clientRequestId` reuse; and an oversized upload is reported as `400` rather than `413`.

## 2. Shared Response Schemas

The following schemas are reused by the endpoint definitions. The example values do not constrain production IDs or dates.

### 2.1 `RequesterSummary`

| Property | JSON type | Constraints |
|---|---|---|
| `id` | integer | Positive |
| `displayName` | string | Non-empty display label |
| `email` | string | Valid stored email address |

```json
{
  "id": 12,
  "displayName": "Mali Chantarangsu",
  "email": "mali@example.com"
}
```

### 2.2 `LookupItem`

Used for both categories and related systems.

| Property | JSON type | Constraints |
|---|---|---|
| `id` | integer | Positive |
| `name` | string | Non-empty display label |

```json
{
  "id": 3,
  "name": "Hardware"
}
```

### 2.3 `Attachment`

| Property | JSON type | Constraints |
|---|---|---|
| `id` | integer | Positive |
| `fileName` | string | Safe display filename derived from the original client filename; 1-255 Unicode characters and safely encoded on download |
| `mediaType` | string | One of the allowed MIME types in Section 3.6 |
| `sizeBytes` | integer | `1` through `5242880` |
| `uploadedAt` | string | UTC RFC 3339 date-time |
| `isRemoved` | boolean | Soft-removal state |
| `removedAt` | string or `null` | Removal time, otherwise `null` |
| `removalReason` | string or `null` | Stored reason when removed, otherwise `null` |
| `downloadable` | boolean | `true` only while the attachment is active |

Active attachment example:

```json
{
  "id": 51,
  "fileName": "monitor-damage.jpg",
  "mediaType": "image/jpeg",
  "sizeBytes": 248031,
  "uploadedAt": "2026-08-20T07:16:00.000Z",
  "isRemoved": false,
  "removedAt": null,
  "removalReason": null,
  "downloadable": true
}
```

Soft-removed attachment example:

```json
{
  "id": 51,
  "fileName": "monitor-damage.jpg",
  "mediaType": "image/jpeg",
  "sizeBytes": 248031,
  "uploadedAt": "2026-08-20T07:16:00.000Z",
  "isRemoved": true,
  "removedAt": "2026-08-20T08:02:11.000Z",
  "removalReason": "Uploaded a clearer image instead.",
  "downloadable": false
}
```

Storage keys/paths and any server-generated filenames are never exposed by the API.

The server discards client-supplied directory components before validating the basename. A filename containing NUL, CR/LF, or another control character is rejected. The resulting display filename must contain 1-255 Unicode characters and retain one permitted extension. An empty, overlong, or otherwise unsafe result is rejected rather than truncated silently. The display filename is metadata only and is never used as a filesystem path.

### 2.4 `TicketSummary`

| Property | JSON type | Constraints |
|---|---|---|
| `id` | integer | Positive internal ID |
| `ticketNumber` | string | Unique; pattern `^TKT-[0-9]{4}-[0-9]{6}$` |
| `summary` | string | 5-120 characters |
| `requestedPriority` | string | One of `LOW`, `MEDIUM`, or `HIGH` |
| `status` | string | Exactly `New` in this sprint |
| `category` | `LookupItem` | Selected category snapshot by relation |
| `relatedSystem` | `LookupItem` | Selected related system by relation |
| `activeAttachmentCount` | integer | `0` through `5`; removed files are excluded |
| `createdAt` | string | UTC RFC 3339 date-time |
| `updatedAt` | string | UTC RFC 3339 date-time |

```json
{
  "id": 145,
  "ticketNumber": "TKT-2026-000145",
  "summary": "External monitor flickers intermittently",
  "requestedPriority": "HIGH",
  "status": "New",
  "category": {
    "id": 3,
    "name": "Hardware"
  },
  "relatedSystem": {
    "id": 8,
    "name": "Office Workstation"
  },
  "activeAttachmentCount": 1,
  "createdAt": "2026-08-20T07:15:30.000Z",
  "updatedAt": "2026-08-20T07:16:00.000Z"
}
```

### 2.5 `TicketDetail`

`TicketDetail` contains every `TicketSummary` property, including required `requestedPriority`, plus the following required properties:

| Property | JSON type | Constraints |
|---|---|---|
| `description` | string | 10-2,000 characters |
| `requester` | `RequesterSummary` | Owning requester |
| `attachments` | array of `Attachment` | Active and soft-removed records, ordered by `uploadedAt` ascending then `id` ascending |

```json
{
  "id": 145,
  "ticketNumber": "TKT-2026-000145",
  "summary": "External monitor flickers intermittently",
  "description": "The external monitor flickers after the laptop wakes from sleep.",
  "requestedPriority": "HIGH",
  "status": "New",
  "requester": {
    "id": 12,
    "displayName": "Mali Chantarangsu",
    "email": "mali@example.com"
  },
  "category": {
    "id": 3,
    "name": "Hardware"
  },
  "relatedSystem": {
    "id": 8,
    "name": "Office Workstation"
  },
  "activeAttachmentCount": 1,
  "attachments": [
    {
      "id": 51,
      "fileName": "monitor-damage.jpg",
      "mediaType": "image/jpeg",
      "sizeBytes": 248031,
      "uploadedAt": "2026-08-20T07:16:00.000Z",
      "isRemoved": false,
      "removedAt": null,
      "removalReason": null,
      "downloadable": true
    }
  ],
  "createdAt": "2026-08-20T07:15:30.000Z",
  "updatedAt": "2026-08-20T07:16:00.000Z"
}
```

### 2.6 `TicketCreateResult`

| Property | JSON type | Constraints |
|---|---|---|
| `ticket` | `TicketDetail` | Newly created or previously created ticket for this logical request |
| `replayed` | boolean | `false` for the first successful creation; `true` for a same-request replay |

The envelope shape is identical for `201 Created` and `200 OK`; only `replayed` and the HTTP status differ.

## 3. Endpoint Contracts

### 3.1 List active requesters

```http
GET /api/requesters
```

Returns the simulated requester choices. This route does not require or use `x-requester-id`; a supplied value is ignored.

#### Request

- Headers: none beyond normal HTTP negotiation.
- Query parameters: none. Unknown query parameters are ignored because they do not affect selection or scope.
- Body: none.

#### `200 OK`

Response schema: JSON array of `RequesterSummary`. Only rows with `isActive = true` are included. Results are ordered by `displayName` ascending, then `id` ascending. An empty result is `[]`.

```json
[
  {
    "id": 12,
    "displayName": "Mali Chantarangsu",
    "email": "mali@example.com"
  },
  {
    "id": 27,
    "displayName": "Narin Wongchai",
    "email": "narin@example.com"
  }
]
```

No `400`, `403`, `404`, or `409` application outcome is defined for this parameterless route. An unexpected requester-data failure returns `500 INTERNAL_ERROR` using the safe envelope in Section 1.4.

---

### 3.2 Get selectable reference data

```http
GET /api/metadata
```

Returns the selector data required by the Create Ticket and My Tickets screens. This route does not require or use `x-requester-id`; a supplied value is ignored.

#### Request

- Headers: none beyond normal HTTP negotiation.
- Query parameters: none. Unknown query parameters are ignored.
- Body: none.

#### `200 OK`

Response schema:

| Property | JSON type | Meaning |
|---|---|---|
| `categories` | array of `LookupItem` | Active categories available for selection |
| `relatedSystems` | array of `LookupItem` | Active related systems available for selection |

Only rows with `isActive = true` are returned. Each array is ordered by `name` ascending, then `id` ascending. Either array may be empty. Historical tickets may still expose their related inactive category or system label through ticket relations; inactive values are excluded here so they cannot be selected for new tickets.

```json
{
  "categories": [
    {
      "id": 3,
      "name": "Hardware"
    },
    {
      "id": 4,
      "name": "Software"
    }
  ],
  "relatedSystems": [
    {
      "id": 8,
      "name": "Office Workstation"
    },
    {
      "id": 9,
      "name": "VPN"
    }
  ]
}
```

No `400`, `403`, `404`, or `409` application outcome is defined for this parameterless route. An unexpected reference-data failure returns `500 INTERNAL_ERROR` using the safe envelope in Section 1.4.

---

### 3.3 Create a ticket

```http
POST /api/tickets
x-requester-id: 12
Content-Type: application/json
```

The server derives ownership from `x-requester-id`, generates the ticket number, and forces the initial status to `New`. The client must not send `requesterId`, `ticketNumber`, or `status`. The client does supply a stable `clientRequestId` so an ambiguous or retried logical submission cannot create a duplicate ticket.

#### Request JSON schema

| Property | JSON type | Required | Validation |
|---|---|:---:|---|
| `clientRequestId` | string | yes | Canonical UUID string generated once per logical create attempt |
| `summary` | string | yes | Trimmed length 5-120 characters |
| `description` | string | yes | Trimmed length 10-2,000 characters |
| `categoryId` | integer | yes | Positive ID of an existing active category |
| `relatedSystemId` | integer | yes | Positive ID of an existing active related system |
| `requestedPriority` | string | yes | One of `LOW`, `MEDIUM`, or `HIGH` |

`additionalProperties` is false.

```json
{
  "clientRequestId": "c5404d4c-0b9b-4c52-9f3a-24872db6996f",
  "summary": "External monitor flickers intermittently",
  "description": "The external monitor flickers after the laptop wakes from sleep.",
  "categoryId": 3,
  "relatedSystemId": 8,
  "requestedPriority": "HIGH"
}
```

#### Duplicate-submission and replay contract

`clientRequestId` identifies one logical ticket-create attempt and is protected by a database unique constraint. The client generates it once and retains the same value while retrying an unresolved attempt; ordinary field edits before the first submission do not require a new value.

The normalized duplicate-comparison payload consists of the validated requester context, `categoryId`, `relatedSystemId`, trimmed `summary`, trimmed `description`, and `requestedPriority`:

1. The server validates requester context, JSON object shape, known fields, UUID, scalar types, text boundaries, IDs, and priority values, then looks up `clientRequestId`.
2. A sequential retry after the first creation has committed, including a retry after the first response was lost, returns the original ticket with `200 OK` and `replayed: true` when the key, requester, and normalized payload match. Replay does not depend on the historical category or related system still being active and does not change `updatedAt`.
3. An existing key with a different requester or different normalized payload returns `409 DUPLICATE_REQUEST_CONFLICT` and creates or changes nothing.
4. A new key is accepted only after category and related-system references are also verified as active. It creates exactly one ticket and stores the key and normalized payload atomically.

#### `201 Created` — first creation

- Response schema: `TicketCreateResult` with `replayed: false`; its `ticket` is a `TicketDetail` with `status: "New"`, `activeAttachmentCount: 0`, and `attachments: []`.
- Response header: `Location: /api/tickets/{id}`.
- `ticketNumber` is allocated by the backend in the form `TKT-YYYY-XXXXXX`, where `YYYY` is the UTC creation year and `XXXXXX` is a zero-padded, collision-safe six-digit sequence. Allocation and insertion are atomic, the database enforces uniqueness, and the number is immutable.

```json
{
  "ticket": {
    "id": 145,
    "ticketNumber": "TKT-2026-000145",
    "summary": "External monitor flickers intermittently",
    "description": "The external monitor flickers after the laptop wakes from sleep.",
    "requestedPriority": "HIGH",
    "status": "New",
    "requester": {
      "id": 12,
      "displayName": "Mali Chantarangsu",
      "email": "mali@example.com"
    },
    "category": {
      "id": 3,
      "name": "Hardware"
    },
    "relatedSystem": {
      "id": 8,
      "name": "Office Workstation"
    },
    "activeAttachmentCount": 0,
    "attachments": [],
    "createdAt": "2026-08-20T07:15:30.000Z",
    "updatedAt": "2026-08-20T07:15:30.000Z"
  },
  "replayed": false
}
```

#### `200 OK` — idempotent replay

The response uses the same `TicketCreateResult` shape and `Location` header as first creation, returns the original ticket unchanged, and sets `replayed: true`.

#### `409 Conflict` — conflicting key reuse

```json
{
  "error": {
    "code": "DUPLICATE_REQUEST_CONFLICT",
    "message": "clientRequestId was already used for a different request."
  }
}
```

This response never reveals the requester or ticket associated with the earlier use of the key.

#### Error outcomes

| Status | Error code | Condition |
|---:|---|---|
| `400` | `INVALID_REQUESTER_CONTEXT` | Missing, malformed, unknown, or inactive requester header |
| `400` | `INVALID_JSON` | Malformed JSON or wrong JSON value type |
| `400` | `VALIDATION_ERROR` | Missing/unknown fields, invalid UUID/priority, or text/ID constraint failure |
| `400` | `INVALID_REFERENCE` | For a new key, `categoryId` or `relatedSystemId` is syntactically valid but identifies no active metadata row |
| `409` | `DUPLICATE_REQUEST_CONFLICT` | `clientRequestId` was already used by another requester or with a different normalized payload |
| `500` | `INTERNAL_ERROR` | Unexpected creation, number-allocation, or database failure; no partial new ticket is committed |

No client-selected requester can create a ticket for another requester because requester ownership is not a body field. A client that loses a response retries with the same `clientRequestId`; it must not generate a new key merely because the first outcome is unknown.

---

### 3.4 List my tickets

```http
GET /api/tickets?search=monitor&status=New&requestedPriority=HIGH&categoryId=3&relatedSystemId=8&sortBy=createdAt&sortOrder=desc&page=1&pageSize=10
x-requester-id: 12
```

Every result and the total count are scoped to the validated requester before search, filters, sorting, or pagination are applied.

#### Query parameter schema

| Parameter | Type | Required | Default | Rules |
|---|---|:---:|---|---|
| `search` | string | no | none | Trimmed, case-insensitive substring match against `ticketNumber` or `summary`; 1-120 characters after trimming |
| `status` | string | no | none | Currently only `New` |
| `requestedPriority` | enum | no | none | `LOW`, `MEDIUM`, or `HIGH` |
| `categoryId` | integer | no | none | Positive decimal ID |
| `relatedSystemId` | integer | no | none | Positive decimal ID |
| `sortBy` | enum | no | `createdAt` | `createdAt`, `ticketNumber`, or `summary` |
| `sortOrder` | enum | no | `desc` | `asc` or `desc` |
| `page` | integer | no | `1` | Minimum `1` |
| `pageSize` | integer | no | `10` | One of `10`, `20`, or `50` |

Each parameter may occur at most once. A supplied blank `search` is normalized to no search. All active filters use AND semantics. Metadata IDs that are well-formed but have no matching owned ticket produce an empty collection, not an error. Sorting uses `id` in the same direction as a deterministic tie-breaker so records do not move unpredictably between pages.

#### `200 OK`

Response schema:

| Property | JSON type | Meaning |
|---|---|---|
| `items` | array of `TicketSummary` | Requested page of owned tickets |
| `pagination.page` | integer | Effective page number |
| `pagination.pageSize` | integer | Effective page size |
| `pagination.totalItems` | integer | Count after requester scope and filters, before pagination |
| `pagination.totalPages` | integer | `ceil(totalItems / pageSize)`; `0` when no items match |
| `sort.by` | string | Effective sort field |
| `sort.order` | string | Effective sort direction |
| `filters.search` | string or `null` | Effective trimmed search value |
| `filters.status` | string or `null` | Effective status filter |
| `filters.requestedPriority` | string or `null` | Effective requested-priority filter |
| `filters.categoryId` | integer or `null` | Effective category filter |
| `filters.relatedSystemId` | integer or `null` | Effective related-system filter |

Requesting a page greater than `totalPages` returns `200` with an empty `items` array while preserving count and effective page metadata.

```json
{
  "items": [
    {
      "id": 145,
      "ticketNumber": "TKT-2026-000145",
      "summary": "External monitor flickers intermittently",
      "requestedPriority": "HIGH",
      "status": "New",
      "category": {
        "id": 3,
        "name": "Hardware"
      },
      "relatedSystem": {
        "id": 8,
        "name": "Office Workstation"
      },
      "activeAttachmentCount": 1,
      "createdAt": "2026-08-20T07:15:30.000Z",
      "updatedAt": "2026-08-20T07:16:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 10,
    "totalItems": 1,
    "totalPages": 1
  },
  "sort": {
    "by": "createdAt",
    "order": "desc"
  },
  "filters": {
    "search": "monitor",
    "status": "New",
    "requestedPriority": "HIGH",
    "categoryId": 3,
    "relatedSystemId": 8
  }
}
```

#### Error outcomes

| Status | Error code | Condition |
|---:|---|---|
| `400` | `INVALID_REQUESTER_CONTEXT` | Missing, malformed, unknown, or inactive requester header |
| `400` | `INVALID_QUERY` | Repeated, unsupported, or out-of-range query parameter |
| `500` | `INTERNAL_ERROR` | Unexpected requester-scoped list or count failure |

This collection route does not return `403` for unowned tickets; unowned rows are excluded before counting. It does not return `404` for an empty result.

---

### 3.5 Get an owned ticket detail

```http
GET /api/tickets/:id
x-requester-id: 12
```

#### Request

- `:id`: required positive decimal integer ticket ID.
- Body: none.

#### `200 OK`

Response schema: `TicketDetail`. This endpoint is the Lab 2 attachment-metadata retrieval capability; no separate metadata-list endpoint is required. Its `attachments` array includes both active and soft-removed attachment metadata in the deterministic order defined in Section 2.5. Removed entries have `downloadable: false`, and no entry exposes a storage key or filesystem path.

See the complete `TicketDetail` example in Section 2.5.

#### Error outcomes

| Status | Error code | Condition |
|---:|---|---|
| `400` | `INVALID_REQUESTER_CONTEXT` | Missing, malformed, unknown, or inactive requester header |
| `400` | `INVALID_PATH_PARAMETER` | `:id` is not a positive decimal integer |
| `403` | `TICKET_FORBIDDEN` | Ticket exists but is owned by another requester |
| `404` | `TICKET_NOT_FOUND` | No ticket has that ID |
| `500` | `INTERNAL_ERROR` | Unexpected ticket-detail or attachment-metadata retrieval failure |

---

### 3.6 Upload an attachment to an owned ticket

```http
POST /api/tickets/:id/attachments
x-requester-id: 12
Content-Type: multipart/form-data; boundary=...
```

#### Request multipart schema

The multipart form must contain exactly one file part named `file`. No JSON metadata and no second file are accepted.

| Constraint | Rule |
|---|---|
| Display filename | Discard path components; reject NUL, CR/LF, and control characters; the resulting basename must be 1-255 Unicode characters and retain a permitted extension |
| Filename extension/MIME pairs | `.jpg` or `.jpeg` with `image/jpeg`; `.png` with `image/png`; `.webp` with `image/webp`; `.pdf` with `application/pdf` |
| Content validation | The sanitized filename extension and declared MIME type must match one permitted pair above |
| File size | 1 through 5,242,880 bytes. The labsheet says `5 MB` without defining a byte convention; the team interprets that limit as binary 5 MiB (`5,242,880` bytes), while the UI label remains `5 MB` |
| Active limit | At most 5 non-removed attachments per ticket |

The server-side active count is authoritative: when the ticket already has 5 non-removed attachments, the server rejects another upload. Soft-removed records do not count toward the active limit, so a replacement can be uploaded after removal. The safe display filename derived from the original filename is stored as metadata, but it is never treated as a server path.

#### `201 Created`

Response schema: the created `Attachment` in its active state.

```json
{
  "id": 51,
  "fileName": "monitor-damage.jpg",
  "mediaType": "image/jpeg",
  "sizeBytes": 248031,
  "uploadedAt": "2026-08-20T07:16:00.000Z",
  "isRemoved": false,
  "removedAt": null,
  "removalReason": null,
  "downloadable": true
}
```

#### Error outcomes

| Status | Error code | Condition |
|---:|---|---|
| `400` | `INVALID_REQUESTER_CONTEXT` | Missing, malformed, unknown, or inactive requester header |
| `400` | `INVALID_PATH_PARAMETER` | `:id` is not a positive decimal integer |
| `400` | `INVALID_MULTIPART` | Missing/incorrect multipart body, missing `file`, multiple files, or unexpected parts |
| `400` | `ATTACHMENT_FILENAME_INVALID` | Display filename is empty, longer than 255 characters, contains unsafe control characters, or has no permitted extension |
| `400` | `ATTACHMENT_TYPE_NOT_ALLOWED` | Sanitized filename extension or declared MIME type is unsupported, or they are not a permitted pair |
| `400` | `ATTACHMENT_SIZE_INVALID` | Empty file or file larger than 5,242,880 bytes; this is the team's binary 5 MiB interpretation of the labsheet's byte-undefined `5 MB` limit |
| `400` | `ATTACHMENT_LIMIT_REACHED` | Ticket already has 5 active attachments |
| `403` | `TICKET_FORBIDDEN` | Ticket exists but is owned by another requester |
| `404` | `TICKET_NOT_FOUND` | No ticket has that ID |
| `500` | `INTERNAL_ERROR` | Unexpected storage or database failure; no attachment metadata is committed |

Ticket existence and ownership are checked as part of upload processing. A failed upload does not commit an attachment metadata row.

---

### 3.7 Download an active attachment

```http
GET /api/tickets/:id/attachments/:attId/download
x-requester-id: 12
```

#### Request

- `:id`: required positive decimal integer ticket ID.
- `:attId`: required positive decimal integer attachment ID.
- Body: none.

#### `200 OK`

The response body is raw file bytes, not JSON.

Required response headers:

```http
Content-Type: image/jpeg
Content-Length: 248031
Content-Disposition: attachment; filename="monitor-damage.jpg"; filename*=UTF-8''monitor-damage.jpg
```

The filename parameters must be safely escaped/encoded. `Content-Type` is the validated stored MIME type.

#### Error outcomes

Error bodies still use the JSON error envelope and `Content-Type: application/json; charset=utf-8`.

| Status | Error code | Condition |
|---:|---|---|
| `400` | `INVALID_REQUESTER_CONTEXT` | Missing, malformed, unknown, or inactive requester header |
| `400` | `INVALID_PATH_PARAMETER` | `:id` or `:attId` is not a positive decimal integer |
| `403` | `TICKET_FORBIDDEN` | Ticket exists but is owned by another requester |
| `404` | `TICKET_NOT_FOUND` | No ticket has `:id` |
| `404` | `ATTACHMENT_NOT_FOUND` | Attachment does not exist within that ticket |
| `404` | `ATTACHMENT_NOT_AVAILABLE` | Attachment is soft-removed; its bytes must not be returned |
| `500` | `INTERNAL_ERROR` | Unexpected lookup/storage failure before streaming, including active metadata whose bytes are unavailable |

The API must never redirect to or reveal a storage path. Authorization and file availability are checked before any stream begins. An unexpected pre-stream failure returns the safe JSON `500` envelope.

---

### 3.8 Soft-remove an owned attachment

```http
PATCH /api/tickets/:id/attachments/:attId/remove
x-requester-id: 12
Content-Type: application/json
```

This endpoint changes attachment state only. It does not delete the database record, stored metadata, ticket, or audit reason.

#### Request JSON schema

| Property | JSON type | Required | Validation |
|---|---|:---:|---|
| `reason` | string | yes | Trimmed length 5-500 characters |

`additionalProperties` is false.

```json
{
  "reason": "Uploaded a clearer image instead."
}
```

#### `200 OK`

Response schema: the updated `Attachment`, with `isRemoved: true`, a non-null `removedAt`, the trimmed `removalReason`, and `downloadable: false`.

```json
{
  "id": 51,
  "fileName": "monitor-damage.jpg",
  "mediaType": "image/jpeg",
  "sizeBytes": 248031,
  "uploadedAt": "2026-08-20T07:16:00.000Z",
  "isRemoved": true,
  "removedAt": "2026-08-20T08:02:11.000Z",
  "removalReason": "Uploaded a clearer image instead.",
  "downloadable": false
}
```

After success, the metadata row remains visible in owned ticket detail, but both its download endpoint and any repeated removal attempt return `404 ATTACHMENT_NOT_AVAILABLE`. The metadata row and its original `removedAt` and `removalReason` audit values are retained. Physical stored-object retention or garbage collection is an internal storage policy, not a Lab 2 acceptance requirement; regardless of that policy, removed bytes remain unreachable through the API and must never regain download access.

#### Error outcomes

| Status | Error code | Condition |
|---:|---|---|
| `400` | `INVALID_REQUESTER_CONTEXT` | Missing, malformed, unknown, or inactive requester header |
| `400` | `INVALID_PATH_PARAMETER` | `:id` or `:attId` is not a positive decimal integer |
| `400` | `INVALID_JSON` | Malformed JSON or wrong JSON value type |
| `400` | `VALIDATION_ERROR` | Missing/unknown field or reason outside 5-500 trimmed characters |
| `403` | `TICKET_FORBIDDEN` | Ticket exists but is owned by another requester |
| `404` | `TICKET_NOT_FOUND` | No ticket has `:id` |
| `404` | `ATTACHMENT_NOT_FOUND` | Attachment does not exist within that ticket |
| `404` | `ATTACHMENT_NOT_AVAILABLE` | Attachment is already soft-removed; its original audit fields are unchanged |
| `500` | `INTERNAL_ERROR` | Unexpected removal failure; attachment state and audit fields remain unchanged |

The attachment state update is atomic: `isRemoved`, `removedAt`, and `removalReason` become effective together.

## 4. Exact Status-Code Matrix

| Endpoint | `200` | `201` | `400` | `403` | `404` | `409` | `500` |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| `GET /api/requesters` | Active requester array | - | - | - | - | - | Safe unexpected failure |
| `GET /api/metadata` | Reference-data object | - | - | - | - | - | Safe unexpected failure |
| `POST /api/tickets` | Replay result (`replayed: true`) | First-create result (`replayed: false`) | Header/body/reference validation | - | - | Conflicting key reuse | Safe unexpected failure |
| `GET /api/tickets` | Scoped paged list | - | Header/query validation | - | - | - | Safe unexpected failure |
| `GET /api/tickets/:id` | Owned ticket and attachment metadata | - | Header/path validation | Existing unowned ticket | Missing ticket | - | Safe unexpected failure |
| `POST /api/tickets/:id/attachments` | - | Created attachment | Header/path/file/limit validation | Existing unowned ticket | Missing ticket | - | Safe unexpected failure |
| `GET /api/tickets/:id/attachments/:attId/download` | File bytes | - | Header/path validation | Existing unowned ticket | Missing ticket/attachment or removed attachment | - | Safe pre-stream failure |
| `PATCH /api/tickets/:id/attachments/:attId/remove` | Removed attachment metadata | - | Header/path/body validation | Existing unowned ticket | Missing ticket/attachment or removed attachment | - | Safe unexpected failure |

`-` means the status is not a defined application outcome for that endpoint.

## 5. Cross-Cutting Implementation Requirements

- Ticket creation, `clientRequestId` replay/conflict handling, unique number allocation, and soft removal must be transaction-safe.
- `ticketNumber`, requester ownership, upload metadata, removal timestamp, and removal reason are server-controlled fields.
- `requestedPriority` is required client input on creation and is validated against `LOW`, `MEDIUM`, and `HIGH`; it is never confused with a future IT-assigned priority.
- List count and list items must use the same requester scope and filters, including `requestedPriority`.
- Database indexes should support unique `ticketNumber`, unique `clientRequestId`, requester-scoped `createdAt` listing, requester/status/requested-priority filtering, category/system filters, and attachment lookup by ticket and removal state.
- Logs and errors must not expose file contents, storage paths, stack traces, database connection details, or tickets belonging to another requester.
- No endpoint in this document changes a ticket beyond initial `New`, publishes comments, or provides IT Staff actions.
- Clients must still render server validation errors even when matching client-side validation exists; client validation is not an API security boundary.
- Ticket-create contract tests cover first creation (`201`, `replayed: false`), an exact sequential or lost-response replay (`200`, `replayed: true`), changed-payload and changed-requester conflict (`409`), one persisted logical ticket, and unchanged replay timestamps.
- Contract tests must force representative unexpected reference-data, create/list/detail, attachment-storage, and removal failures. They assert the exact `500 INTERNAL_ERROR` envelope and JSON content type, absence of internal details, no committed attachment metadata after a failed upload, and the safe pre-stream `500` download case.
