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

- A dedicated Development Requester Selection screen that establishes a simulated requester context before ticket screens are available.
- Active category and related-system reference data.
- Ticket creation with required category, related system, summary, requested priority, and description.
- Retry-safe duplicate-submission prevention for each logical ticket creation.
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

Before any ticket screen is available, the UI shall present a dedicated Development Requester Selection screen with an active-requester dropdown and a **Continue** action that remains disabled until a valid option is selected. The screen shall provide loading, no-active-requester, recoverable-error, and Retry states. Continuing stores only the selected integer ID in browser-tab `sessionStorage`, supplies that ID as the `x-requester-id` header on ticket and attachment requests, and enters the requester-facing application. A missing, malformed, unknown, or inactive stored value shall be cleared and shall gate or redirect every requester-scoped deep link back to this screen before requester-owned data is requested or displayed.

After entry, the app shell shall show the current requester as read-only context and provide **Change Requester**. Changing or clearing the selection shall immediately clear previously displayed requester-owned state, cancel or disregard obsolete in-flight responses, clear the stored ID, and return to Development Requester Selection.

If any protected request later returns `400 INVALID_REQUESTER_CONTEXT` because the committed requester became unknown or inactive, the client shall perform the same clear-and-return transition immediately. It shall not retry using the rejected context.

### FR-02 — Present the ticket form

The Create Ticket view shall load active categories and related systems and provide required controls for category, related system, summary, requested priority, and description. Ticket Number and Ticket Date shall appear as server-owned read-only values with pre-create placeholders, while the current requester is shown read-only. The form shall show the validation rules defined in BR-05 through BR-07 and BR-13, place messages beside the affected field, and preserve safe user input after a recoverable error. Required reference-data loading, empty, and failure states shall block submission without discarding entered data.

### FR-03 — Create a ticket

With an active requester selected and a valid payload containing a new `clientRequestId`, the system shall create exactly one ticket owned by that requester and return HTTP `201`. On success, the UI shall show the server-generated ticket number, Ticket Date derived from `createdAt`, and `New` status and provide a path to its detail. Invalid input shall not create a partial ticket and shall return HTTP `400` with field-addressable errors. Retrying an outcome-unknown logical submission shall follow FR-12 rather than create another ticket.

### FR-04 — Generate a unique ticket number

The backend shall generate, persist, and return a unique ticket number that conforms to BR-01. A client-provided ticket number or status shall be ignored or rejected; neither value is client-controlled.

### FR-05 — List “My Tickets”

The My Tickets view shall retrieve only tickets owned by the selected requester. Each result shall expose, at minimum, ticket number, summary, category, related system, requested priority, status, and creation time, and shall link to the owned detail. Initial loading, no owned tickets, no results for active criteria, and recoverable error states shall be visually and semantically distinct.

### FR-06 — Search, filter, sort, and paginate tickets

The requester shall be able to search case-insensitively by ticket number or summary; filter by status, category, related system, and requested priority; sort by an allowed field and direction; and navigate server-side pages. Query controls shall combine with logical AND, reset to page 1 when search/filter/sort criteria change, and preserve ownership scoping. The response shall include page metadata so the UI can render navigation accurately.

### FR-07 — View an owned ticket

The Ticket Detail view shall show the complete owned ticket, its category and related-system labels, requested priority, status, timestamps, and active and soft-removed attachment metadata. `GET /api/tickets/:id` explicitly fulfills the Retrieve Attachment Metadata capability as part of the detail response. An owner request returns HTTP `200`; a request for another requester’s existing ticket returns `403`; a nonexistent ticket returns `404`.

### FR-08 — Upload an attachment

The owner shall be able to upload one attachment at a time to an existing ticket using `multipart/form-data`. The client shall pre-check type, size, and active-count rules for usability, and the server shall enforce BR-08 through BR-10 authoritatively. A successful upload returns HTTP `201` and the new attachment metadata.

### FR-09 — Download an active attachment

The owner shall be able to download an active attachment through the authorized API. The response shall use the stored media type and a safe `Content-Disposition` filename. Removed attachments shall not be downloadable, and neither a direct URL nor a guessed identifier shall bypass ticket ownership.

### FR-10 — Soft-remove an attachment

The owner shall be able to supply a mandatory reason and soft-remove an active attachment. A successful operation shall retain audit metadata, mark the attachment removed, immediately block further download, and free one active-attachment slot. Repeating removal of the same attachment shall not overwrite the original audit information and shall return `404` because it is no longer an active attachment.

### FR-11 — Enforce ownership protection

Every ticket list, ticket detail, upload, download, and removal operation shall derive its requester from `x-requester-id` and enforce the relationship on the server. UI route guards or hidden controls are not sufficient. Missing or malformed requester context returns `400`, an existing resource owned by somebody else returns `403`, and a resource that does not exist returns `404`.

### FR-12 — Prevent duplicate ticket creation

The client shall generate one UUID `clientRequestId` for each logical ticket submission before its first attempt and shall reuse that value after a timeout, lost response, or other outcome-unknown retry. The server shall persist and enforce that key according to BR-14 so a replay cannot create a second ticket. Disabling the submit action while a request is pending remains required for usability but is not the authoritative duplicate-prevention mechanism.

## 5. Business Rules

### BR-01 — Ticket number

The backend shall allocate a database-safe unique ticket number in the exact form `TKT-YYYY-XXXXXX`, matching `^TKT-\d{4}-\d{6}$`. `YYYY` is the ticket creation year in UTC and `XXXXXX` is a zero-padded six-digit sequence allocated for that year. A unique database constraint is authoritative; concurrency stress behavior is implementation hardening outside the Lab 2 acceptance scope.

### BR-02 — Initial status

Every newly created ticket has the exact status `New`. No request in this sprint may set or change status, and no other status is exposed as an actionable workflow.

### BR-03 — Simulated login only

`x-requester-id` represents the requester confirmed on Development Requester Selection. It is required on requester-scoped endpoints but is not proof of identity and must never be described as secure authentication. The client persists only the selected integer ID in browser-tab `sessionStorage`; it stores no requester profile, credential, token, or protected ticket data there. Production authentication and role authorization remain out of scope.

### BR-04 — Active requesters

Only requesters whose `isActive` value is `true` are returned by the requester selector endpoint or accepted as the current context for new operations. A restored ID must be revalidated against the active list before protected data is requested. Missing, malformed, unknown, or inactive values are cleared and return the tester to Development Requester Selection. Inactive requesters and their data remain stored but are hidden from the selector.

### BR-05 — Summary length

Summary is required. After trimming leading and trailing whitespace, it must contain 5–120 Unicode characters. The trimmed value is persisted; whitespace-only input is invalid.

### BR-06 — Description length

Description is required. After trimming leading and trailing whitespace, it must contain 10–2,000 Unicode characters. The trimmed value is persisted; whitespace-only input is invalid.

### BR-07 — Ticket reference data

`categoryId` and `relatedSystemId` are both required and must identify existing active records. A missing, inactive, or unknown reference is a validation failure and returns `400`; metadata labels sent by a client do not override stored reference data.

### BR-08 — Attachment type

Only these extension and declared media-type pairs are accepted: `.jpg` or `.jpeg` with `image/jpeg`, `.png` with `image/png`, `.webp` with `image/webp`, and `.pdf` with `application/pdf`. Comparison is case-insensitive for the extension. The sanitized filename extension and multipart media type must agree. File-signature inspection and malware scanning are production hardening outside this sprint.

### BR-09 — Attachment size

The labsheet states a maximum of “5 MB” but does not define its byte conversion. As an explicit team decision for deterministic implementation and boundary tests, this specification interprets that label as the binary limit 5 MiB, exactly 5,242,880 bytes. Each attachment must contain at least 1 byte; 5,242,880 bytes is valid and 5,242,881 bytes is invalid. This interpretation must be changed consistently if the instructor confirms a decimal 5,000,000-byte limit.

### BR-10 — Attachment count

A ticket may have no more than five active attachments. The server checks the active count and rejects a sixth attachment. Soft-removed attachments remain in the audit history but do not count toward the limit. Concurrent-upload stress handling is not an acceptance requirement for this sprint.

### BR-11 — Attachment soft-removal

Removal requires a trimmed reason of 5–500 Unicode characters. The attachment row, original filename, size, media type, storage reference, uploader, removal actor, and timestamps are retained; `removedAt`, `removalReason`, and `removedByRequesterId` are set once. Any attachment with `removedAt != null` is excluded from active lists and returns `404` from the download endpoint.

### BR-12 — Ownership

A ticket belongs to exactly one requester. Only that owner may list or view it or upload, download, and remove its attachments. The API validates the parent ticket before resolving a nested attachment: an existing ticket owned by another requester returns `403` and performs no mutation; after an owned parent is established, an unknown attachment or an attachment that does not belong to that route ticket returns `404`. This distinction must be applied consistently without exposing ticket or attachment content.

### BR-13 — Requested priority

`requestedPriority` is required when a ticket is created and has exactly one of the API values `LOW`, `MEDIUM`, or `HIGH`. It is persisted with the ticket, returned by create/list/detail responses, available as a My Tickets filter, and displayed as Low, Medium, or High without relying on color alone. Because ticket editing is excluded from this sprint, requested priority is immutable after creation.

### BR-14 — Idempotent ticket creation

Every logical ticket submission has one required client-generated UUID `clientRequestId`, stored under a database unique constraint. Duplicate comparison uses the validated requester and normalized `categoryId`, `relatedSystemId`, trimmed `summary`, `requestedPriority`, and trimmed `description`; attachment selection is excluded because attachments upload only after ticket creation.

The first successful creation returns `201` with `replayed: false`. Repeating the same normalized logical request with the same `clientRequestId`, including a retry after a lost response, returns the original ticket with `200` and `replayed: true`, without changing its `updatedAt`. Reusing that ID with different normalized content or a different requester returns `409 DUPLICATE_REQUEST_CONFLICT` and creates nothing. A unique database constraint remains required, but concurrency stress behavior is not part of the Lab 2 acceptance suite.

### BR-15 — Safe unexpected failures

An unexpected failure on a JSON endpoint returns `500 INTERNAL_ERROR` using the common error envelope and a stable endpoint-appropriate message. It shall not expose stack traces, SQL, ORM or database details, credentials, storage keys, or filesystem paths. Transactional operations shall return no success response and leave no partial ticket, attachment metadata, or requester-visible file. For downloads, this JSON error contract applies only before response streaming begins; mid-stream transport failure handling is outside the Lab 2 acceptance scope.

## 6. UI Specification Summary

The UI follows the Zen Green token system: Primary Green `#006B3C`, Secondary Green `#0B7A46`, Pale Green `#EAF6EF`, Page Background `#F5F7F6`, Text Charcoal `#1A2E22`, Error `#D32F2F`, Warning `#8A5500`, and Warning Background `#FFF4D6`. Editable and read-only controls, required indicators, validation placement, focus treatment, busy states, semantically distinct empty/no-results/failure states, attachment states, and screenshot evidence are defined in [ui-spec.md](./ui-spec.md). Status, priority, warning, success, error, and removal meaning must never rely on color alone.

Responsive targets are desktop at `>=992px` with multi-column forms and ticket tables, tablet at `768–991px` with two-column forms and horizontally scrollable tables, and mobile at `<768px` with a vertical form, ticket cards, and full-width controls with touch targets at least `44px` high. The acceptance viewports are 1440×900, 834×1112, and 390×844 respectively. Functionality and information must remain equivalent at every target size.

## 7. Data Changes

The existing PostgreSQL/Prisma schema is extended through a migration. Entity fields below are logical camelCase persistence names; migrations may map them to database naming conventions as long as the public contract does not change. Attachment persistence fields map explicitly to the public representation: `originalName` → `fileName`, `mimeType` → `mediaType`, and `createdAt` → `uploadedAt`. Internal `storageKey`, uploader/remover IDs, and other audit-only fields are never exposed unless the API schema names them.

### 7.1 Entities

| Model | Required fields and constraints | Relationships and lifecycle |
|---|---|---|
| `RequesterUser` | `id` positive integer primary key; `displayName` varchar(120); `email` normalized varchar(254), unique; `isActive` boolean default `true`; `createdAt`; `updatedAt` | Owns many tickets. May be recorded as attachment uploader/remover. Records are deactivated, not deleted, when history exists. |
| `Category` | Existing `id` integer primary key and unique `name`; add `isActive` boolean default `true` and `updatedAt`; retain `createdAt` | Referenced by many tickets. Inactive rows remain attached to historical tickets and are omitted from new-ticket metadata. |
| `RelatedSystem` | `id` positive integer primary key; unique `name` varchar(120); optional `description` varchar(500); `isActive` boolean default `true`; `createdAt`; `updatedAt` | Referenced by many tickets. Lifecycle matches `Category`. |
| `Ticket` | `id` positive integer primary key; `ticketNumber` varchar(15), unique and server-generated; `clientRequestId` UUID, unique; `requesterId`, `categoryId`, `relatedSystemId` foreign keys; `summary` varchar(120); `description` varchar(2000); `requestedPriority` enum `LOW`/`MEDIUM`/`HIGH`; `status` constrained to `New` in this sprint; `createdAt`; `updatedAt` | Belongs to one requester, category, and related system; has many attachments. Requester-editable and business fields, including requested priority, are immutable after creation. Attachment operations do not define additional parent-ticket timestamp behavior in this sprint. Referenced rows use restrictive deletion so audit history cannot be orphaned. |
| `Attachment` | `id` positive integer primary key; `ticketId` foreign key; `originalName` varchar(255); unique opaque `storageKey`; `mimeType` varchar(100); `sizeBytes` integer; `uploadedByRequesterId`; `createdAt`; nullable `removedAt`, `removalReason` varchar(500), and `removedByRequesterId` | Belongs to one ticket. Uploader/remover reference `RequesterUser`. No hard-delete path is exposed in this sprint. Active means `removedAt IS NULL`. |

Ticket numbers may use a database-backed per-year counter or another implementation compatible with the unique constraint. The externally testable Lab 2 rules are the format, UTC year, and uniqueness in BR-01; concurrency stress behavior is not part of this issue.

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

- Unique indexes: `RequesterUser.email`, `Category.name`, `RelatedSystem.name`, `Ticket.ticketNumber`, `Ticket.clientRequestId`, and `Attachment.storageKey`.
- Selector/metadata indexes: `(RequesterUser.isActive, displayName)`, `(Category.isActive, name)`, and `(RelatedSystem.isActive, name)`.
- Ticket-list indexes: `(requesterId, createdAt DESC)`, `(requesterId, status, createdAt DESC)`, `(requesterId, requestedPriority, createdAt DESC)`, `(requesterId, categoryId, createdAt DESC)`, and `(requesterId, relatedSystemId, createdAt DESC)`.
- Attachment index: `(ticketId, removedAt, createdAt)` for active count and detail retrieval.
- Foreign-key indexes exist on all relationship columns. Database check constraints enforce positive `sizeBytes`, valid length bounds where practical, the requested-priority enum, and the allowed sprint status.
- Case-insensitive contains search covers `ticketNumber` and `summary`. A PostgreSQL trigram index may be added if measured data volume warrants it; it is not required for the MVP seed volume.

### 7.4 Soft-delete behavior

Only attachments have an in-scope soft-removal operation. Removal updates the three audit fields atomically and never deletes the row. Active attachment queries and counts use `removedAt IS NULL`; audit-oriented ticket detail may return removed attachment metadata with `isRemoved: true`, but never a download URL. Requesters, categories, and related systems use `isActive` for deactivation and are not physically deleted when referenced.

## 8. API Contract

The normative request, response, validation, ownership, and error schemas are in [api-spec.md](./api-spec.md). The endpoint summary is:

| Method and path | Purpose | Success |
|---|---|---:|
| `GET /api/requesters` | List active requester choices | `200` |
| `GET /api/metadata` | List active categories and related systems | `200` |
| `POST /api/tickets` | Create or safely replay a logical ticket request for `x-requester-id` | `201` first create; `200` replay |
| `GET /api/tickets` | Search/filter/sort/page the requester’s tickets | `200` |
| `GET /api/tickets/:id` | Read owned ticket detail and retrieve its attachment metadata | `200` |
| `POST /api/tickets/:id/attachments` | Upload one owned-ticket attachment | `201` |
| `GET /api/tickets/:id/attachments/:attId/download` | Download an active owned attachment | `200` |
| `PATCH /api/tickets/:id/attachments/:attId/remove` | Soft-remove an active owned attachment | `200` |

Requester-scoped endpoints require `x-requester-id`. Contract errors use `400` for malformed/missing context or validation, `403` for an existing parent ticket owned by another requester, `404` for a missing resource, wrong-ticket nested attachment, or attachment that is no longer active, and `409` for conflicting `clientRequestId` reuse. Every JSON endpoint also defines the safe `500 INTERNAL_ERROR` behavior in BR-15 and [api-spec.md](./api-spec.md).

## 9. Acceptance Criteria

### AC-01 — Valid ticket creation

**Given** an active requester is selected, active category and related-system IDs exist, requested priority is `LOW`, `MEDIUM`, or `HIGH`, summary and description satisfy BR-05 and BR-06, and a new valid `clientRequestId` is supplied,

**When** the requester submits the Create Ticket form once,

**Then** the API returns `201` with `replayed: false`, exactly one owned ticket with the selected priority is persisted, and that ticket is available in the requester’s list and detail view.

### AC-02 — Server-generated identity and state

**Given** any valid ticket-creation request, including one that attempts to send a ticket number, Ticket Date, or status,

**When** the backend creates the ticket,

**Then** it controls or rejects those server-owned fields, returns a unique number matching `TKT-YYYY-XXXXXX`, returns status `New`, and returns `createdAt` as the authoritative Ticket Date displayed after creation.

### AC-03 — “My Tickets” ownership isolation

**Given** requester A and requester B each own tickets,

**When** requester A calls the ticket-list endpoint,

**Then** every returned item and the reported total belong to requester A, each item includes its requested priority, and no ticket or attachment metadata owned by requester B is present.

### AC-04 — Search, filter, sort, and pagination

**Given** requester A owns enough varied tickets to span multiple pages,

**When** A combines a case-insensitive ticket-number/summary search with valid status, category, related-system, and requested-priority filters, a supported sort, and page parameters,

**Then** the API returns only matching owned tickets in the requested stable order and returns correct `page`, `pageSize`, `totalItems`, and `totalPages` values.

### AC-05 — Ticket-detail ownership

**Given** requester A owns an existing ticket,

**When** A requests it, requester B requests it, and either requester requests a nonexistent ID,

**Then** the responses are respectively `200` with requested priority and active/removed attachment metadata, `403` without ticket data, and `404`; the detail response fulfills attachment-metadata retrieval without a separate metadata endpoint.

### AC-06 — Attachment validation and active limit

**Given** requester A owns a ticket with fewer than five active attachments,

**When** A uploads a permitted JPG, PNG, WEBP, or PDF containing 1 byte through the team's Lab 2 interpretation of 5 MB: 5 MiB (`5,242,880` bytes),

**Then** the API returns `201` and lists its metadata; and **when** the type/extension is invalid, size is outside the range, or a sixth active attachment is attempted, **then** it returns `400` and persists no new attachment.

### AC-07 — Authorized active download

**Given** requester A owns a ticket with an active attachment,

**When** A downloads the attachment,

**Then** the API returns `200` with the correct media type, byte content, and safe filename; and **when** requester B uses the same route, **then** it returns `403` without file content.

### AC-08 — Reasoned soft-removal

**Given** requester A owns an active attachment,

**When** A omits an acceptable removal reason,

**Then** the API returns `400` and the attachment remains active; and **when** A supplies a valid reason, **then** the API returns `200`, retains and marks the attachment metadata with the original reason and removal time, excludes it from the active count, and every later download or repeated removal returns `404`.

### AC-09 — Requested priority contract

**Given** each allowed requested-priority value and invalid missing, wrong-type, or unsupported values,

**When** a requester creates a ticket or filters My Tickets by priority,

**Then** `LOW`, `MEDIUM`, and `HIGH` are accepted, persisted, returned, filtered, and rendered consistently; invalid values return a field-specific `400` without creating a ticket; and the value cannot be edited after creation.

### AC-10 — Requester selection and switching

**Given** active, inactive, and malformed requester contexts, including a committed requester that becomes inactive during the session,

**When** Development Requester Selection loads, Continue is attempted, a requester is confirmed, a protected deep link is opened, persisted context is restored, or **Change Requester** is activated,

**Then** only active options are selectable, Continue is disabled without a valid choice, invalid context is cleared before any protected fetch, confirmed context appears read-only in the app shell, and switching clears requester-owned state and prevents stale in-flight responses from rendering under the next requester. A protected `400 INVALID_REQUESTER_CONTEXT` also clears the rejected context and returns to selection without retrying it. Loading, no-active-requester, recoverable-error, and Retry states are explicit and accessible.

### AC-11 — Idempotent duplicate submission

**Given** a ticket was successfully created for a requester using a `clientRequestId`,

**When** the same normalized logical request is repeated with that ID after a lost response or explicit retry,

**Then** no second ticket is created and the replay returns the original ticket with `200` and `replayed: true`; reusing the ID with different normalized content or a different requester returns `409 DUPLICATE_REQUEST_CONFLICT`; and a client retry after an outcome-unknown response reuses the original ID.

### AC-12 — Empty, no-results, and failure recovery

**Given** requester/reference data, ticket queries, detail, upload, download, or removal can be loading, empty, unmatched, or fail recoverably,

**When** each state occurs,

**Then** the UI distinguishes initial loading, no available data, no results for active search/filter criteria, and safe retryable failure; exposes the appropriate Retry, clear-criteria, or recovery action; preserves eligible user input where required; and never displays stale or cross-requester data.

### AC-13 — Responsive behavior

**Given** Development Requester Selection, Create Ticket, My Tickets, and Ticket Detail at the documented 1440×900 desktop, 834×1112 tablet, and 390×844 mobile targets,

**When** the primary states and workflows are exercised at those three acceptance viewports,

**Then** equivalent information and actions remain usable, controls reflow without overlap or page-level horizontal overflow, mobile targets are at least `44px` high, and any tablet table overflow is confined to its intended local container.

### AC-14 — Accessibility

**Given** a keyboard-only or assistive-technology user,

**When** they complete requester selection and ticket/attachment workflows,

**Then** controls have associated labels and accessible names, keyboard order and visible focus are logical, route/dialog focus is managed and restored, validation is associated to its field, dynamic loading/success/warning/error states are announced, modal focus is trapped and dismissible as documented, and no meaning depends on color alone.

### AC-15 — Safe unexpected failure

**Given** an injected unexpected database, transaction, or storage failure,

**When** a JSON endpoint handles it before committing or before a download stream begins,

**Then** it returns the documented `500 INTERNAL_ERROR` envelope and safe message, exposes no implementation detail, and commits no partial requester-visible state.

## 10. Definition of Done

### Code and data

- [ ] The reviewed Prisma migration, deterministic seed data, Express routes/services, and React views implement all included FRs and BRs without implementing excluded workflows.
- [ ] Backend validation is authoritative and consistent with the client messages and API contract.
- [ ] Ticket-number uniqueness, `clientRequestId` first-create/replay/conflict behavior, and the five-active-attachment rule satisfy the documented Lab 2 cases.
- [ ] Attachment bytes are stored outside the public static path under opaque names and are served only through the authorized download route.
- [ ] Client and server production builds complete without TypeScript errors.

### Test coverage

- [ ] Unit tests cover validation boundaries, filename/media-type matching, numbering, query normalization, and ownership helpers.
- [ ] API/integration tests cover every endpoint and the `200`, `201`, `400`, `403`, `404`, `409`, and safe `500` paths defined by the contract.
- [ ] UI component tests cover Development Requester Selection, session restore/switching, form validation and idempotent retries, distinct empty/no-results/failure states, list controls, detail rendering, and attachment actions.
- [ ] Automated accessibility checks exercise keyboard flow, focus behavior, labels/associations, live announcements, and dialog semantics; manual inspection supplements rather than replaces these assertions.
- [ ] E2E tests prove requester selection, the primary creation/replay flow, state clearing on requester switching, cross-requester isolation, and failure recovery, and all automated tests pass from a clean database.
- [ ] AC-01 through AC-15 are linked to passing test IDs in [tests.md](./tests.md).

### Responsive UI and accessibility

- [ ] Development Requester Selection, Create Ticket, My Tickets, and Ticket Detail pass the desktop, tablet, and mobile acceptance viewports in [ui-spec.md](./ui-spec.md).
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
- **Required creation fields:** Category, related system, Summary, Requested Priority, and Description are mandatory so every submitted ticket has sufficient routing context. Inactive lookup values remain visible on historical details but cannot be selected for new tickets. Requested Priority uses only `LOW`, `MEDIUM`, and `HIGH` and is immutable in this sprint.
- **Development context persistence:** The client stores only a validated requester integer ID in browser-tab `sessionStorage`. It revalidates the value before protected data loads and clears it on Change Requester or when the value is malformed, unknown, or inactive.
- **Idempotent creation:** A client-generated UUID `clientRequestId` identifies one logical ticket submission. First create, exact replay, conflicting reuse, and lost-response retry follow BR-14. Concurrency stress testing is deferred beyond Lab 2.
- **UTC owns time-derived behavior:** Ticket-number year and API timestamps use UTC. Timestamps are returned as ISO 8601 strings ending in `Z`.
- **Server-side list operations:** Search, filter, sort, and pagination are performed before serialization in the database query; the UI does not fetch all tickets and filter locally. Default paging is page 1, 10 items per page, sorted by `createdAt desc`; permitted page sizes are 10, 20, and 50.
- **Search surface:** The MVP search matches ticket number and summary case-insensitively. Description search is excluded to keep query behavior predictable and indexable.
- **File storage:** The MVP may use server-managed local storage outside the web root with randomized storage keys. Original names are metadata only. A storage adapter boundary should allow later cloud storage without changing the REST contract.
- **Attachment-limit interpretation:** The labsheet says “5 MB” without an exact byte definition. The team chose the binary interpretation 5 MiB (`5,242,880` bytes) so the API and tests have one deterministic boundary. This is a documented team decision, not a byte count quoted from the labsheet.
- **Create-then-upload flow:** Ticket creation is JSON and attachment upload is a separate request after a ticket ID exists. Attachment-level retry/idempotency, staged multi-file upload, and compensation workflows are outside this sprint.
- **Attachment metadata retrieval:** `GET /api/tickets/:id` returns `TicketDetail.attachments` and is the required Retrieve Attachment Metadata capability; no separate list endpoint is needed for this sprint.
- **Removed-file retention:** Soft-removal preserves the attachment metadata row and audit fields. Physical-byte retention, quarantine, and garbage collection remain internal storage policy and are not acceptance-tested in Lab 2.
- **Error consistency:** All JSON errors, including safe `500 INTERNAL_ERROR`, follow the envelope defined in [api-spec.md](./api-spec.md); UI messages may be friendlier but must preserve field attribution and must not expose stack traces or storage paths.
- **Stable pagination:** Every sort includes `id` as a deterministic tie-breaker. Out-of-range pages return `200` with an empty `items` array and accurate totals rather than `404`.
- **Specification precedence:** If implementation comments or older Lab 1 behavior conflict with these Lab 2 documents, these four Lab 2 specifications govern Issue 1. Contract changes require a documentation and test-plan update before implementation changes.
