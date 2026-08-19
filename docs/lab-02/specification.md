# Lab 2 — Issue 1: Sprint Engineering Specification

**Product:** TokTickIT requester ticketing MVP

**Delivery method:** Specification-Driven Development (Spec DD) followed by Test-Driven Development (TDD)

**Status:** Implementation baseline; changes require corresponding updates to the API, UI, and test specifications

**Companion documents:** [UI specification](./ui-spec.md) · [API specification](./api-spec.md) · [test plan](./tests.md)

## 1. Sprint Goal

Deliver a responsive requester ticketing MVP with the Zen Green UI, a simulated login context, ticket submission, attachment management, a personal ticket list, ticket detail, and strict ownership isolation.

At the end of the sprint, a requester can select their seeded identity, create and review only their own tickets, find those tickets efficiently, and upload, download, or soft-remove valid attachments. The system generates the ticket identity and initial state on the server. This specification is the contract to be tested before implementation is considered complete.

## 2. Stakeholder Request Interpretation

The stakeholder needs the requester-facing slice of an IT service desk, not a complete service-management platform. In engineering terms, the sprint will add the minimum data model, REST API, and responsive React UI needed for a seeded requester to create and retrieve owned tickets and manage their attachments. The selected requester is carried as an explicit request header so ownership behavior can be developed and tested now; it must not be represented as real authentication.

The backend is authoritative for validation, ticket numbering, status, ownership, pagination, and attachment access. Client-side validation exists for immediate feedback but never replaces server validation. All list and object access is scoped by the current requester, including attachment operations.

## 3. Scope

### Included

- An active-requester selector that supplies a simulated requester context.
- Active category and related-system reference data.
- Ticket creation with required category, related system, summary, and description.
- Server-generated ticket numbers and the initial `New` status.
- A requester-scoped “My Tickets” list with search, filters, sorting, and pagination.
- Requester-owned ticket detail.
- Attachment upload, authorized download, and reasoned soft-removal.
- Responsive Zen Green presentation for desktop, tablet, and mobile.
- Database migrations and seed updates required by the models in section 7.
- Unit, API/integration, UI component, responsive, and end-to-end verification described in [tests.md](./tests.md).

### Explicitly excluded

- Authentication, password handling, sessions, tokens, single sign-on, authorization roles, and production login security. The requester selector is a simulation only.
- IT Staff queues, assignment, triage, dashboards, editing, or any other staff workflow.
- Public or internal comments and comment notifications.
- Status transitions or progression beyond `New`, including resolved/closed workflows.
- Requester profile administration, category administration, and related-system administration.
- Ticket editing or deletion after submission.
- Malware scanning, cloud object storage, email notifications, and attachment retention jobs.

## 4. Functional Requirements

### FR-01 — Select requester context

The UI shall load active requesters and require the user to select one before any requester-scoped action. The selection shall supply the `x-requester-id` header on ticket and attachment requests. Switching or clearing the selection shall clear previously displayed requester-owned data before another request is made.

### FR-02 — Present the ticket form

The Create Ticket view shall load active categories and related systems and provide required controls for category, related system, summary, and description. It shall show the validation rules defined in BR-05 through BR-07, place messages beside the affected field, preserve safe user input after a recoverable error, and prevent duplicate submission while busy.

### FR-03 — Create a ticket

With an active requester selected and a valid payload, the system shall create exactly one ticket owned by that requester and return HTTP `201`. On success, the UI shall show the generated ticket number and `New` status and provide a path to its detail. Invalid input shall not create a partial ticket and shall return HTTP `400` with field-addressable errors.

### FR-04 — Generate a unique ticket number

The backend shall generate, persist, and return a unique ticket number that conforms to BR-01. A client-provided ticket number or status shall be ignored or rejected; neither value is client-controlled.

### FR-05 — List “My Tickets”

The My Tickets view shall retrieve only tickets owned by the selected requester. Each result shall expose, at minimum, ticket number, summary, category, related system, status, and creation time, and shall link to the owned detail. Empty, loading, and recoverable error states shall be explicit.

### FR-06 — Search, filter, sort, and paginate tickets

The requester shall be able to search case-insensitively by ticket number or summary; filter by status, category, and related system; sort by an allowed field and direction; and navigate server-side pages. Query controls shall combine with logical AND, reset to page 1 when search/filter/sort criteria change, and preserve ownership scoping. The response shall include page metadata so the UI can render navigation accurately.

### FR-07 — View an owned ticket

The Ticket Detail view shall show the complete owned ticket, its category and related-system labels, status, timestamps, and attachment metadata. An owner request returns HTTP `200`; a request for another requester’s existing ticket returns `403`; a nonexistent ticket returns `404`.

### FR-08 — Upload an attachment

The owner shall be able to upload one attachment at a time to an existing ticket using `multipart/form-data`. The client shall pre-check type, size, and active-count rules for usability, and the server shall enforce BR-08 through BR-10 authoritatively. A successful upload returns HTTP `201` and the new attachment metadata.

### FR-09 — Download an active attachment

The owner shall be able to download an active attachment through the authorized API. The response shall use the stored media type and a safe `Content-Disposition` filename. Removed attachments shall not be downloadable, and neither a direct URL nor a guessed identifier shall bypass ticket ownership.

### FR-10 — Soft-remove an attachment

The owner shall be able to supply a mandatory reason and soft-remove an active attachment. A successful operation shall retain audit metadata, mark the attachment removed, immediately block further download, and free one active-attachment slot. Repeating removal of the same attachment shall not overwrite the original audit information and shall return `404` because it is no longer an active attachment.

### FR-11 — Enforce ownership protection

Every ticket list, ticket detail, upload, download, and removal operation shall derive its requester from `x-requester-id` and enforce the relationship on the server. UI route guards or hidden controls are not sufficient. Missing or malformed requester context returns `400`, an existing resource owned by somebody else returns `403`, and a resource that does not exist returns `404`.

## 5. Business Rules

### BR-01 — Ticket number

The backend shall allocate a database-safe unique ticket number in the exact form `TKT-YYYY-XXXXXX`, matching `^TKT-\d{4}-\d{6}$`. `YYYY` is the ticket creation year in UTC and `XXXXXX` is a zero-padded six-digit sequence allocated for that year. A unique database constraint and atomic allocation/retry behavior shall prevent duplicates under concurrent requests.

### BR-02 — Initial status

Every newly created ticket has the exact status `New`. No request in this sprint may set or change status, and no other status is exposed as an actionable workflow.

### BR-03 — Simulated login only

`x-requester-id` represents the requester selected in the demo UI. It is required on requester-scoped endpoints but is not proof of identity and must never be described as secure authentication. Production authentication and role authorization remain out of scope.

### BR-04 — Active requesters

Only requesters whose `isActive` value is `true` are returned by the requester selector endpoint or accepted as the current context for new operations. Inactive requesters and their data remain stored but are hidden from the selector.

### BR-05 — Summary length

Summary is required. After trimming leading and trailing whitespace, it must contain 5–120 Unicode characters. The trimmed value is persisted; whitespace-only input is invalid.

### BR-06 — Description length

Description is required. After trimming leading and trailing whitespace, it must contain 10–2,000 Unicode characters. The trimmed value is persisted; whitespace-only input is invalid.

### BR-07 — Ticket reference data

`categoryId` and `relatedSystemId` are both required and must identify existing active records. A missing, inactive, or unknown reference is a validation failure and returns `400`; metadata labels sent by a client do not override stored reference data.

### BR-08 — Attachment type

Only these extension and media-type pairs are accepted: `.jpg` or `.jpeg` with `image/jpeg`, `.png` with `image/png`, `.webp` with `image/webp`, and `.pdf` with `application/pdf`. Comparison is case-insensitive for the extension. Both the sanitized filename extension and detected/validated media type must agree; changing an extension alone does not make a file valid.

### BR-09 — Attachment size

Each attachment must contain at least 1 byte and may contain at most 5 MiB, defined exactly as 5,242,880 bytes. The boundary value is valid; 5,242,881 bytes is invalid.

### BR-10 — Attachment count

A ticket may have no more than five active attachments. The count and insert shall be enforced atomically to prevent concurrent uploads from exceeding five. Soft-removed attachments remain in the audit history but do not count toward the limit.

### BR-11 — Attachment soft-removal

Removal requires a trimmed reason of 5–500 Unicode characters. The attachment row, original filename, size, media type, storage reference, uploader, removal actor, and timestamps are retained; `removedAt`, `removalReason`, and `removedByRequesterId` are set once. Any attachment with `removedAt != null` is excluded from active lists and returns `404` from the download endpoint.

### BR-12 — Ownership

A ticket belongs to exactly one requester. Only that owner may list or view it or upload, download, and remove its attachments. The same ownership predicate must be applied before an attachment action, and attachment IDs must also belong to the ticket ID in the route. Cross-owner access to an existing ticket or attachment returns `403` and performs no mutation.

## 6. UI Specification Summary

The UI follows the Zen Green token system: Primary Green `#006B3C`, Secondary Green `#0B7A46`, Pale Green `#EAF6EF`, Page Background `#F5F7F6`, Text Charcoal `#1A2E22`, and Error `#D32F2F`. Editable and read-only controls, required indicators, validation placement, focus treatment, busy states, empty states, attachment states, and screenshot evidence are defined in [ui-spec.md](./ui-spec.md).

Responsive targets are desktop at `>=992px` with multi-column forms and ticket tables, tablet at `768–991px` with two-column forms and horizontally scrollable tables, and mobile at `<768px` with a vertical form, ticket cards, and full-width controls with touch targets at least `44px` high. Functionality and information must remain equivalent at every target size.

## 7. Data Changes

The existing PostgreSQL/Prisma schema is extended through a migration. API names below are logical camelCase names; migrations may map them to database naming conventions as long as the public contract does not change.

### 7.1 Entities

| Model | Required fields and constraints | Relationships and lifecycle |
|---|---|---|
| `RequesterUser` | `id` positive integer primary key; `displayName` varchar(120); `email` normalized varchar(254), unique; `isActive` boolean default `true`; `createdAt`; `updatedAt` | Owns many tickets. May be recorded as attachment uploader/remover. Records are deactivated, not deleted, when history exists. |
| `Category` | Existing `id` integer primary key and unique `name`; add `isActive` boolean default `true` and `updatedAt`; retain `createdAt` | Referenced by many tickets. Inactive rows remain attached to historical tickets and are omitted from new-ticket metadata. |
| `RelatedSystem` | `id` positive integer primary key; unique `name` varchar(120); optional `description` varchar(500); `isActive` boolean default `true`; `createdAt`; `updatedAt` | Referenced by many tickets. Lifecycle matches `Category`. |
| `Ticket` | `id` positive integer primary key; `ticketNumber` varchar(15), unique and server-generated; `requesterId`, `categoryId`, `relatedSystemId` foreign keys; `summary` varchar(120); `description` varchar(2000); `status` constrained to `New` in this sprint; `createdAt`; `updatedAt` | Belongs to one requester, category, and related system; has many attachments. Referenced rows use restrictive deletion so audit history cannot be orphaned. |
| `Attachment` | `id` positive integer primary key; `ticketId` foreign key; `originalName` varchar(255); unique opaque `storageKey`; `mimeType` varchar(100); `sizeBytes` integer; `uploadedByRequesterId`; `createdAt`; nullable `removedAt`, `removalReason` varchar(500), and `removedByRequesterId` | Belongs to one ticket. Uploader/remover reference `RequesterUser`. No hard-delete path is exposed in this sprint. Active means `removedAt IS NULL`. |

Ticket numbers require an atomic, database-backed per-year counter or an equivalent transactionally safe allocation mechanism. This implementation detail may use a small counter table, but the externally testable rules are the format, UTC year, and uniqueness in BR-01.

### 7.2 Relationships

```text
RequesterUser 1 ── * Ticket * ── 1 Category
                         *
                         │
                         1
                  RelatedSystem
Ticket        1 ── * Attachment
RequesterUser 1 ── * Attachment (uploadedBy / removedBy)
```

### 7.3 Indexes and constraints

- Unique indexes: `RequesterUser.email`, `Category.name`, `RelatedSystem.name`, `Ticket.ticketNumber`, and `Attachment.storageKey`.
- Selector/metadata indexes: `(RequesterUser.isActive, displayName)`, `(Category.isActive, name)`, and `(RelatedSystem.isActive, name)`.
- Ticket-list indexes: `(requesterId, createdAt DESC)`, `(requesterId, status, createdAt DESC)`, `(requesterId, categoryId, createdAt DESC)`, and `(requesterId, relatedSystemId, createdAt DESC)`.
- Attachment index: `(ticketId, removedAt, createdAt)` for active count and detail retrieval.
- Foreign-key indexes exist on all relationship columns. Database check constraints enforce positive `sizeBytes`, valid length bounds where practical, and the allowed sprint status.
- Case-insensitive contains search covers `ticketNumber` and `summary`. A PostgreSQL trigram index may be added if measured data volume warrants it; it is not required for the MVP seed volume.

### 7.4 Soft-delete behavior

Only attachments have an in-scope soft-removal operation. Removal updates the three audit fields atomically and never deletes the row. Active attachment queries and counts use `removedAt IS NULL`; audit-oriented ticket detail may return removed attachment metadata with `isRemoved: true`, but never a download URL. Requesters, categories, and related systems use `isActive` for deactivation and are not physically deleted when referenced.

## 8. API Contract

The normative request, response, validation, ownership, and error schemas are in [api-spec.md](./api-spec.md). The endpoint summary is:

| Method and path | Purpose | Success |
|---|---|---:|
| `GET /api/requesters` | List active requester choices | `200` |
| `GET /api/metadata` | List active categories and related systems | `200` |
| `POST /api/tickets` | Create a ticket for `x-requester-id` | `201` |
| `GET /api/tickets` | Search/filter/sort/page the requester’s tickets | `200` |
| `GET /api/tickets/:id` | Read owned ticket detail | `200` |
| `POST /api/tickets/:id/attachments` | Upload one owned-ticket attachment | `201` |
| `GET /api/tickets/:id/attachments/:attId/download` | Download an active owned attachment | `200` |
| `PATCH /api/tickets/:id/attachments/:attId/remove` | Soft-remove an active owned attachment | `200` |

Requester-scoped endpoints require `x-requester-id`. Contract errors use `400` for malformed/missing context or validation, `403` for an existing resource owned by another requester, and `404` for a missing resource or an attachment that is no longer active. Unexpected infrastructure failures use `500`, although `500` is not an expected acceptance outcome.

## 9. Acceptance Criteria

### AC-01 — Valid ticket creation

**Given** an active requester is selected, active category and related-system IDs exist, and summary and description satisfy BR-05 and BR-06,

**When** the requester submits the Create Ticket form once,

**Then** the API returns `201`, exactly one owned ticket is persisted, and that ticket is available in the requester’s list and detail view.

### AC-02 — Server-generated identity and state

**Given** any valid ticket-creation request, including one that attempts to send a ticket number or status,

**When** the backend creates the ticket,

**Then** it controls or rejects those server-owned fields, returns a unique number matching `TKT-YYYY-XXXXXX`, and returns status `New`.

### AC-03 — “My Tickets” ownership isolation

**Given** requester A and requester B each own tickets,

**When** requester A calls the ticket-list endpoint,

**Then** every returned item and the reported total belong to requester A, and no ticket or attachment metadata owned by requester B is present.

### AC-04 — Search, filter, sort, and pagination

**Given** requester A owns enough varied tickets to span multiple pages,

**When** A combines a case-insensitive ticket-number/summary search with valid status, category, and related-system filters, a supported sort, and page parameters,

**Then** the API returns only matching owned tickets in the requested stable order and returns correct `page`, `pageSize`, `totalItems`, and `totalPages` values.

### AC-05 — Ticket-detail ownership

**Given** requester A owns an existing ticket,

**When** A requests it, requester B requests it, and either requester requests a nonexistent ID,

**Then** the responses are respectively `200` with full detail, `403` without ticket data, and `404`.

### AC-06 — Attachment validation and active limit

**Given** requester A owns a ticket with fewer than five active attachments,

**When** A uploads a permitted JPG, PNG, WEBP, or PDF containing 1–5,242,880 bytes,

**Then** the API returns `201` and lists its metadata; and **when** the type/extension is invalid, size is outside the range, or a sixth active attachment is attempted, **then** it returns `400` and persists no new attachment.

### AC-07 — Authorized active download

**Given** requester A owns a ticket with an active attachment,

**When** A downloads the attachment,

**Then** the API returns `200` with the correct media type, byte content, and safe filename; and **when** requester B uses the same route, **then** it returns `403` without file content.

### AC-08 — Reasoned soft-removal

**Given** requester A owns an active attachment,

**When** A omits an acceptable removal reason,

**Then** the API returns `400` and the attachment remains active; and **when** A supplies a valid reason, **then** the API returns `200`, retains and marks the attachment metadata with the original reason and removal time, excludes it from the active count, and every later download or repeated removal returns `404`.

## 10. Definition of Done

### Code and data

- [ ] The reviewed Prisma migration, deterministic seed data, Express routes/services, and React views implement all included FRs and BRs without implementing excluded workflows.
- [ ] Backend validation is authoritative and consistent with the client messages and API contract.
- [ ] Ticket-number allocation and the five-active-attachment rule are safe under concurrent requests.
- [ ] Attachment bytes are stored outside the public static path under opaque names and are served only through the authorized download route.
- [ ] Client and server production builds complete without TypeScript errors.

### Test coverage

- [ ] Unit tests cover validation boundaries, filename/media-type matching, numbering, query normalization, and ownership helpers.
- [ ] API/integration tests cover every endpoint and the `200`, `201`, `400`, `403`, and `404` paths defined by the contract.
- [ ] UI component tests cover form validation, busy/disabled behavior, list controls and states, detail rendering, and attachment actions.
- [ ] E2E tests prove the primary creation flow and cross-requester isolation, and all automated tests pass from a clean database.
- [ ] AC-01 through AC-08 are linked to passing test IDs in [tests.md](./tests.md).

### Responsive UI and accessibility

- [ ] Create Ticket, My Tickets, and Ticket Detail pass the desktop, tablet, and mobile checklist in [ui-spec.md](./ui-spec.md).
- [ ] Required inputs have visible labels, programmatic error associations, keyboard-visible focus, and no color-only meaning.
- [ ] Interactive targets are at least `44px` high on mobile and no page has unintended horizontal overflow.

### Review and evidence

- [ ] The pull request is peer-reviewed and all blocking feedback is resolved in `reviewer.md`.
- [ ] Test commands, dated final results, and pass/fail totals are recorded in [tests.md](./tests.md).
- [ ] Required screenshots are stored at the exact evidence paths in [ui-spec.md](./ui-spec.md) and linked from the documentation.
- [ ] Any deviation from this baseline is documented and approved in all affected specifications before merge.

## 11. Assumptions and Decisions

- **Existing stack retained:** React 18, TypeScript, Vite, and Bootstrap remain the client stack; Express, TypeScript, Prisma, and PostgreSQL remain the server stack; Vitest, React Testing Library, and Supertest remain the automated-test stack. This minimizes unrelated change.
- **Positive integer identifiers:** Public entity IDs and `x-requester-id` are positive base-10 integers because the existing Prisma `Category` model uses integer IDs. The header remains a string on the wire and is parsed strictly.
- **Both metadata fields required:** Category and related system are mandatory so every submitted ticket has sufficient routing context. Inactive lookup values remain visible on historical details but cannot be selected for new tickets.
- **UTC owns time-derived behavior:** Ticket-number year and API timestamps use UTC. Timestamps are returned as ISO 8601 strings ending in `Z`.
- **Server-side list operations:** Search, filter, sort, and pagination are performed before serialization in the database query; the UI does not fetch all tickets and filter locally. Default paging is page 1, 10 items per page, sorted by `createdAt desc`; permitted page sizes are 10, 20, and 50.
- **Search surface:** The MVP search matches ticket number and summary case-insensitively. Description search is excluded to keep query behavior predictable and indexable.
- **File storage:** The MVP may use server-managed local storage outside the web root with randomized storage keys. Original names are metadata only. A storage adapter boundary should allow later cloud storage without changing the REST contract.
- **Create-then-upload flow:** Ticket creation is JSON and attachment upload is a separate request after a ticket ID exists. If a UI stages files during creation, it creates the ticket first and uploads each file afterward; an upload failure does not roll back the valid ticket and must be reported clearly.
- **Removed-file retention:** Soft-removal preserves the database row and stored object for this lab so audit behavior is testable. Production retention, quarantine, and purge policies are deferred.
- **Error consistency:** All JSON errors follow the envelope defined in [api-spec.md](./api-spec.md); UI messages may be friendlier but must preserve field attribution and must not expose stack traces or storage paths.
- **Stable pagination:** Every sort includes `id` as a deterministic tie-breaker. Out-of-range pages return `200` with an empty `items` array and accurate totals rather than `404`.
- **Specification precedence:** If implementation comments or older Lab 1 behavior conflict with these Lab 2 documents, these four Lab 2 specifications govern Issue 1. Contract changes require a documentation and test-plan update before implementation changes.
