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
- Successful responses return the resource or collection directly; there is no additional `data` envelope.

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
5. For attachment routes, resolve `:attId` within that ticket; return `404 ATTACHMENT_NOT_FOUND` if it does not exist or belongs to a different ticket.

This rule makes `403` behavior testable while ensuring another requester can never read ticket content, attachment metadata, or file bytes, or mutate the ticket's attachments.

### 1.4 Error response schema

Every defined `400`, `403`, and `404` response uses this JSON shape:

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

Only `200`, `201`, `400`, `403`, and `404` are application outcomes in this Lab 2 contract. In particular, the simulated context does not use `401`, validation does not use `409` or `422`, and an oversized upload is reported as `400` rather than `413`. Unexpected infrastructure failures are operational concerns outside the acceptance contract and must never expose stack traces, filesystem paths, or database details.

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
| `fileName` | string | Original client filename, safely encoded on download |
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

### 2.4 `TicketSummary`

| Property | JSON type | Constraints |
|---|---|---|
| `id` | integer | Positive internal ID |
| `ticketNumber` | string | Unique; pattern `^TKT-[0-9]{4}-[0-9]{6}$` |
| `summary` | string | 5-120 characters |
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

`TicketDetail` contains every `TicketSummary` property plus the following required properties:

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

No `400`, `403`, or `404` application outcome is defined for this parameterless route.

---

### 3.2 Get ticket metadata

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

No `400`, `403`, or `404` application outcome is defined for this parameterless route.

---

### 3.3 Create a ticket

```http
POST /api/tickets
x-requester-id: 12
Content-Type: application/json
```

The server derives ownership from `x-requester-id`, generates the ticket number, and forces the initial status to `New`. The client must not send `requesterId`, `ticketNumber`, or `status`.

#### Request JSON schema

| Property | JSON type | Required | Validation |
|---|---|:---:|---|
| `summary` | string | yes | Trimmed length 5-120 characters |
| `description` | string | yes | Trimmed length 10-2,000 characters |
| `categoryId` | integer | yes | Positive ID of an existing active category |
| `relatedSystemId` | integer | yes | Positive ID of an existing active related system |

`additionalProperties` is false.

```json
{
  "summary": "External monitor flickers intermittently",
  "description": "The external monitor flickers after the laptop wakes from sleep.",
  "categoryId": 3,
  "relatedSystemId": 8
}
```

#### `201 Created`

- Response schema: `TicketDetail` with `status: "New"`, `activeAttachmentCount: 0`, and `attachments: []`.
- Response header: `Location: /api/tickets/{id}`.
- `ticketNumber` is allocated by the backend in the form `TKT-YYYY-XXXXXX`, where `YYYY` is the UTC creation year and `XXXXXX` is a zero-padded, collision-safe six-digit sequence. Allocation and insertion are atomic, the database enforces uniqueness, and the number is immutable.

```json
{
  "id": 145,
  "ticketNumber": "TKT-2026-000145",
  "summary": "External monitor flickers intermittently",
  "description": "The external monitor flickers after the laptop wakes from sleep.",
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
}
```

#### Error outcomes

| Status | Error code | Condition |
|---:|---|---|
| `400` | `INVALID_REQUESTER_CONTEXT` | Missing, malformed, unknown, or inactive requester header |
| `400` | `INVALID_JSON` | Malformed JSON or wrong JSON value type |
| `400` | `VALIDATION_ERROR` | Missing/unknown fields or text/ID constraint failure |
| `400` | `INVALID_REFERENCE` | `categoryId` or `relatedSystemId` is syntactically valid but identifies no active metadata row |

No client-selected requester can create a ticket for another requester because requester ownership is not a body field.

---

### 3.4 List my tickets

```http
GET /api/tickets?search=monitor&status=New&categoryId=3&relatedSystemId=8&sortBy=createdAt&sortOrder=desc&page=1&pageSize=10
x-requester-id: 12
```

Every result and the total count are scoped to the validated requester before search, filters, sorting, or pagination are applied.

#### Query parameter schema

| Parameter | Type | Required | Default | Rules |
|---|---|:---:|---|---|
| `search` | string | no | none | Trimmed, case-insensitive substring match against `ticketNumber` or `summary`; 1-120 characters after trimming |
| `status` | string | no | none | Currently only `New` |
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

Response schema: `TicketDetail`. The `attachments` array deliberately includes soft-removed attachment metadata; those entries have `downloadable: false`.

See the complete `TicketDetail` example in Section 2.5.

#### Error outcomes

| Status | Error code | Condition |
|---:|---|---|
| `400` | `INVALID_REQUESTER_CONTEXT` | Missing, malformed, unknown, or inactive requester header |
| `400` | `INVALID_PATH_PARAMETER` | `:id` is not a positive decimal integer |
| `403` | `TICKET_FORBIDDEN` | Ticket exists but is owned by another requester |
| `404` | `TICKET_NOT_FOUND` | No ticket has that ID |

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
| Filename extension/MIME pairs | `.jpg` or `.jpeg` with `image/jpeg`; `.png` with `image/png`; `.webp` with `image/webp`; `.pdf` with `application/pdf` |
| Content validation | Declared MIME type, extension, and detected file signature must agree |
| File size | 1 through 5,242,880 bytes (5 MiB) |
| Active limit | At most 5 non-removed attachments per ticket |
| Limit concurrency | Count check and insert are atomic; concurrent uploads cannot create a sixth active attachment |

Soft-removed records do not count toward the active limit, so a replacement can be uploaded after removal. The original filename is stored as metadata, but it is never treated as a server path.

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
| `400` | `ATTACHMENT_TYPE_NOT_ALLOWED` | Extension, MIME type, or signature is unsupported or inconsistent |
| `400` | `ATTACHMENT_SIZE_INVALID` | Empty file or file larger than 5,242,880 bytes |
| `400` | `ATTACHMENT_LIMIT_REACHED` | Ticket already has 5 active attachments |
| `403` | `TICKET_FORBIDDEN` | Ticket exists but is owned by another requester |
| `404` | `TICKET_NOT_FOUND` | No ticket has that ID |

Ticket existence and ownership are checked before a file is persisted. A failed request leaves no file or attachment record behind.

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

The API must never redirect to or reveal a storage path. Authorization is checked before any stream begins.

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

After success, the record remains visible in owned ticket detail, but both its download endpoint and any repeated removal attempt return `404 ATTACHMENT_NOT_AVAILABLE`. Physical-byte retention or later garbage collection is an internal policy and must not restore download access. A repeated removal never overwrites the original `removedAt` or `removalReason` audit values.

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

The state update is atomic: `isRemoved`, `removedAt`, and `removalReason` become effective together.

## 4. Exact Status-Code Matrix

| Endpoint | `200` | `201` | `400` | `403` | `404` |
|---|:---:|:---:|:---:|:---:|:---:|
| `GET /api/requesters` | Active requester array | - | - | - | - |
| `GET /api/metadata` | Metadata object | - | - | - | - |
| `POST /api/tickets` | - | Created ticket | Header/body/reference validation | - | - |
| `GET /api/tickets` | Scoped paged list | - | Header/query validation | - | - |
| `GET /api/tickets/:id` | Owned ticket detail | - | Header/path validation | Existing unowned ticket | Missing ticket |
| `POST /api/tickets/:id/attachments` | - | Created attachment | Header/path/file/limit validation | Existing unowned ticket | Missing ticket |
| `GET /api/tickets/:id/attachments/:attId/download` | File bytes | - | Header/path validation | Existing unowned ticket | Missing ticket/attachment or removed attachment |
| `PATCH /api/tickets/:id/attachments/:attId/remove` | Removed attachment metadata | - | Header/path/body validation | Existing unowned ticket | Missing ticket/attachment or removed attachment |

`-` means the status is not a defined application outcome for that endpoint.

## 5. Cross-Cutting Implementation Requirements

- Ticket creation, unique number allocation, attachment active-count enforcement, and soft removal must be transaction-safe.
- `ticketNumber`, requester ownership, upload metadata, removal timestamp, and removal reason are server-controlled fields.
- List count and list items must use the same requester scope and filters.
- Database indexes should support unique `ticketNumber`, requester-scoped `createdAt` listing, requester/status filtering, category/system filters, and attachment lookup by ticket and removal state.
- Logs and errors must not expose file contents, storage paths, stack traces, database connection details, or tickets belonging to another requester.
- No endpoint in this document changes a ticket beyond initial `New`, publishes comments, or provides IT Staff actions.
- Clients must still render server validation errors even when matching client-side validation exists; client validation is not an API security boundary.
