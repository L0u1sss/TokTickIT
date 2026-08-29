# Lab 2 — Test Plan and Verification Evidence

**Document status:** Mixed implementation — Issues #13–#16 now have local automated evidence for the database foundation, Development Requester Selection/context, Create Ticket, and My Tickets slices; every row still marked `Not run` remains planned work.

**Related documents:** [Engineering Specification](./specification.md) · [API Specification](./api-spec.md) · [UI Specification](./ui-spec.md)

The purpose of this plan is to turn FR-01–FR-12, BR-01–BR-15, AC-01–AC-15, and the Issue #13 database foundation into executable checks. Every `Not run` entry is intentionally a TDD placeholder, not evidence of a pass; only an entry with recorded execution evidence may claim a pass.

## 1. Test Strategy

### 1.1 TDD workflow and release gates

For each implementation slice, the team will:

1. Add the smallest relevant test from the plan and confirm that it fails for the expected missing behavior (**Red**).
2. Implement only enough production code to satisfy the test (**Green**).
3. Refactor without changing observable behavior and rerun the affected Lab 2 tests plus the complete client and server regression suites (**Refactor**).
4. Record command output, commit SHA, browser/device viewport, and screenshots in Section 6.

A feature is not complete when only a happy-path UI demonstration passes. Its unit or component checks, API contract checks, ownership checks, relevant responsive checks, both production builds, and existing Lab 1 regression tests must also pass. Failed, skipped, or flaky tests block completion unless a documented scope decision is approved in the pull request.

### 1.2 Test levels

| Level | Tool and environment | Primary purpose | Isolation boundary |
|---|---|---|---|
| Unit | Vitest in Node.js | Validate ticket fields including Requested Priority, ticket-number rules, idempotency normalization, list-query normalization, attachment rules, and soft-removal transitions | Pure functions/services; no HTTP, file-system, or database dependency |
| API / Integration | Vitest + Supertest against the Express app, Prisma, and a dedicated PostgreSQL test database | Verify routes, headers, status codes, response bodies, persistence, idempotency/unique constraints, pagination, attachment metadata/state, ownership enforcement, and safe injected failures | Reset or transaction-isolate fixtures between tests; never use shared development data |
| UI Component | Vitest + jsdom + React Testing Library + `user-event` with mocked API calls | Verify requester selection/context, rendered content, accessible controls, validation placement, loading/disabled states, list interactions, recovery, focus, live regions, and error handling | One page/component at a time; API module mocked at the network boundary |
| Responsive / Visual | Browser automation at fixed viewports plus human screenshot review | Verify actual CSS layout, breakpoints, overflow, card/table switching, Zen Green/warning tokens, selector layout, and 44 px touch targets | Deterministic seed data and fixed desktop/tablet/mobile viewports |
| End-to-End | Planned Playwright browser suite against running client/server and a disposable seeded database | Verify requester selection, context restoration/switching, ticket and attachment lifecycle, idempotent lost-response recovery, state recovery, keyboard operation, and ownership isolation | Fresh database state per run; two active requesters and one inactive requester |

The server Vitest configuration separates a DB-free `unit` project from a sequential `database` project. The implemented `DB-01` suite belongs to the latter and requires an explicitly isolated `TEST_DATABASE_URL`; it cannot fall back to development data. Client tests continue to use `client/tests/**/*.test.tsx`. Supertest and React Testing Library are already installed. No Playwright/Cypress dependency, configuration, or `test:e2e` script exists yet, so browser rows remain planned rather than silently assumed runnable.

### 1.3 Fixtures, controls, and test oracles

- Use three deterministic requester fixtures: active requester A, active requester B, and inactive requester C. A and B must have distinguishable tickets; C must never appear in the requester selector. Also test a successful empty requester response independently from an endpoint failure.
- Seed at least two active categories and two active related systems, plus inactive metadata records, so filters and active-reference validation prove inclusion and exclusion rather than merely render a non-empty list.
- Exercise all three `requestedPriority` values—`LOW`, `MEDIUM`, and `HIGH`—through validation, create persistence/response, list/filter, detail, UI selection/display, and an end-to-end flow. Missing, null, wrong-case, and unsupported values are invalid.
- Freeze the clock for ticket-number tests. Assert the full `^TKT-[0-9]{4}-[0-9]{6}$` format, the expected UTC creation year, the exact `createdAt` value used as Ticket Date, and database-backed uniqueness; do not assert only a prefix.
- **Team decision for the Lab 2 wording:** interpret the labsheet's 5 MB attachment limit as 5 MiB, exactly `5,242,880` bytes. The exact limit is accepted and one byte over is rejected. Construct boundary buffers during the test instead of committing large binaries.
- Keep small, inert JPG, PNG, WEBP, PDF, and disallowed text fixtures under `server/tests/lab-02/fixtures/`. Never use personal or confidential files.
- Test Summary at 4, 5, 120, and 121 trimmed Unicode characters, and Description at 9, 10, 2,000, and 2,001 trimmed Unicode characters. Whitespace-only input is invalid.
- Test attachment-removal reason at 4, 5, 500, and 501 trimmed characters. Whitespace-only input is invalid.
- For each rejected create, upload, or removal request, assert both the error response and the absence of unintended committed metadata or requester-visible state.
- Ownership tests must use the same ticket or attachment identifier first as its owner and then as requester B. A filtered list alone is insufficient evidence because direct-object access must also be protected.
- Pagination tests cover the allowed page sizes `10`, `20`, and `50`, the default page size `10`, and the default sort `createdAt desc`. They use stable seed timestamps and a deterministic tie-breaker so results cannot move between pages when the primary sort values are equal.
- API assertions cover the exact status, documented JSON schema/error code, relevant headers, and persisted state. Download tests additionally compare bytes, MIME type, and `Content-Disposition`.
- UI component tests do not count as responsive evidence: jsdom does not perform real layout. Breakpoint, overflow, pixel size, and screenshot checks run in a real browser.
- Use deterministic UUID fixtures for `clientRequestId`. Verify first-create, identical sequential replay, conflicting reuse, and a simulated lost response followed by sequential retry. Count persisted tickets, not only HTTP responses.
- For injected database and storage failures, assert the safe `500 INTERNAL_ERROR` envelope, absence of stack traces, SQL, Prisma details, filesystem paths, and credentials, plus the absence of partial committed metadata or overwritten audit state.
- Requester-context UI tests reset `sessionStorage` between cases and cover missing, malformed, unknown, inactive, and valid stored integer IDs. Deferred promises must prove that a response from the previous requester cannot repopulate cleared state.
- Accessibility assertions use semantic queries and real keyboard input. Component tests cover ARIA relationships and live regions; browser tests cover visible focus, logical order, dialog trapping, Escape/restoration, and complete keyboard operation.

## 2. Planned Tests

All paths below are repository-relative. `DB-01` is implemented for Issue #13; the requester rows have Issue #14 evidence; Create Ticket has Issue #15 evidence; and the My Tickets rows marked as passed below have fresh local Issue #16 evidence. Every remaining `Not run` entry stays planned until execution evidence is recorded.

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File Path | Final Status |
|---|---|---|---|---|---|---|
| UT-01 | Unit | FR-02; AC-01; AC-09; BR-05–BR-07; BR-13 | Trimming, required values, and boundary values for Summary (5–120), Description (10–2,000), category, related system, and Requested Priority | Boundary-valid input and each exact `LOW`/`MEDIUM`/`HIGH` priority pass; missing, whitespace-only, too-short, too-long, inactive/nonexistent-reference, null, wrong-case, or unsupported-priority input returns a field-specific validation result | `server/tests/lab-02/ticket-validation.test.ts` | PASS — 17/17 locally and in hosted CI on Issue #15 baseline `82a654011a353ac95e5b676509f3d62b0bda8d26`; post-review follow-up CI and peer review pending |
| UT-02 | Unit | FR-04; AC-02; BR-01–BR-02 | Ticket-number construction with a fixed clock and six-digit yearly sequence | Value matches `TKT-YYYY-XXXXXX`, contains the UTC creation year and zero-padded six-digit suffix, exposes the exact `createdAt` used as Ticket Date, and starts with status `New` | `server/tests/lab-02/ticket-number.test.ts` | PASS — 3/3 locally plus PostgreSQL sequence evidence, with hosted CI successful on Issue #15 baseline `82a654011a353ac95e5b676509f3d62b0bda8d26`; post-review follow-up CI and peer review pending |
| UT-03 | Unit | FR-06; AC-04; AC-09; BR-13 | Search trimming, category/Requested Priority/status filters, permitted sorts, default ordering, page bounds, allowed page sizes 10/20/50, and stable secondary sort | Valid values including each priority normalize predictably; unsupported priority/sort/filter or invalid page/page-size values produce a validation error | `server/tests/lab-02/ticket-query.test.ts` | PASS — 21/21 locally in the Issue #16 working tree; final commit SHA, hosted CI, and peer review pending |
| UT-04 | Unit | FR-08; AC-06; BR-08–BR-10 | Safe 1–255-character basename rules, extension/declared-MIME pairs, exact 5 MiB (`5,242,880` byte) boundary, one-byte-over boundary, and active-attachment count | A safe allowed JPG/PNG/WEBP/PDF from 1 byte through 5 MiB passes; path-like input is reduced to its basename; empty/overlong/control-character filenames, mismatched/disallowed type, oversized file, or sixth active attachment fail | `server/tests/lab-02/attachment-validation.test.ts` | Not run |
| UT-05 | Unit | FR-10; AC-08; BR-11 | Removal-reason validation and transition from active to removed | Reason of 5–500 trimmed characters succeeds; invalid reason fails; success records removed flag/time/reason, retains metadata/storage reference, and makes the attachment non-downloadable | `server/tests/lab-02/attachment-removal.test.ts` | Not run |
| UT-06 | Unit | FR-12; AC-11; BR-14 | UUID validation, normalized logical-request fingerprinting, and idempotency outcome selection | The same requester/key/content resolves as replay; changed requester or normalized content resolves as conflict; invalid keys fail validation; attachment selection is excluded from the ticket fingerprint | `server/tests/lab-02/ticket-idempotency.test.ts`<br>`server/tests/lab-02/ticket-service.test.ts` | PASS within the 49/49 local DB-free server suite and hosted CI on Issue #15 baseline `82a654011a353ac95e5b676509f3d62b0bda8d26`; post-review follow-up CI and peer review pending |
| UT-07 | Unit | FR-11; AC-03; AC-05–AC-08; BR-12 | Ticket ownership predicate and nested-attachment lookup outcome selection | Owned parents proceed; an existing foreign parent resolves to `403` before child lookup; missing parents and missing/wrong-ticket children resolve to the documented `404`; no helper returns protected data with a denied outcome | `server/tests/lab-02/ownership.test.ts` | Not run |
| DB-01 | Database / Integration | Specification §7.1–§7.3 and §7.4 persistence state; Definition of Done; Issue #13 | Against a disposable PostgreSQL schema already prepared by `prisma migrate deploy`, verify the applied migration records, five models, canonical columns, enums, defaults, unique/check/FK constraints, relation actions, required composite/FK indexes, attachment audit-state consistency, and repeated deterministic seed | The separately recorded clean migration preparation succeeds; DB-01 confirms its records; invalid writes are rejected by PostgreSQL; exact required indexes and relations exist; two additional seed runs preserve IDs and leave 4 categories, 6 related systems, and 4 active + 1 inactive requester without duplicates | `server/tests/lab-02/db-schema.test.ts` | Fresh local pass — 11/11 on isolated `toktickit_test`; hosted full server-suite step passed on CI baseline `8ef5a9c4b42fe1bf002ebed440f4109ac516ef59`; peer review pending |
| API-01 | API / Integration | FR-01; AC-10; AC-12; BR-03–BR-04 | Development Requester data, deterministic active-only ordering, successful empty response, and public-route header behavior | Returns `200`; only active requesters appear in deterministic order, inactive requester C is absent, an empty source returns `[]`, no header is required, and a supplied development-requester header is ignored | `server/tests/lab-02/requesters.api.test.ts` | Local route-contract pass with mocked Prisma — 5/5; hosted server-suite step passed on CI baseline `8ef5a9c4b42fe1bf002ebed440f4109ac516ef59`; peer review pending |
| API-02 | API / Integration | FR-02; AC-12; BR-07 | Selectable reference-data contract, active-only ordering, independent empty Category/System arrays, and public-route header behavior | Returns `200` with documented arrays and no inactive options; either required list may be empty without changing shape; no requester header is required or used | `server/tests/lab-02/metadata.test.ts` | PASS — 3/3 locally and in hosted CI on Issue #15 baseline `82a654011a353ac95e5b676509f3d62b0bda8d26`; post-review follow-up CI and peer review pending |
| API-03 | API / Integration | FR-01; FR-11; AC-10; BR-03–BR-04; BR-12 | Development-requester-header validation on every protected endpoint | Missing, blank, malformed, repeated, unknown, or inactive context returns the documented non-success code/envelope; no scoped read or mutation occurs | `server/tests/lab-02/requester-context.test.ts` | Not run |
| API-04 | API / Integration | FR-03–FR-04; AC-01–AC-02; AC-09; BR-01–BR-07; BR-13 | Valid `POST /api/tickets` for requester A, parameterized over `LOW`, `MEDIUM`, and `HIGH` | Returns `201` and `Location`; record is owned by A, persists/returns the exact Requested Priority, has a server-generated `TKT-YYYY-XXXXXX` number, status `New`, trimmed fields, empty attachments, and authoritative timestamps | `server/tests/lab-02/tickets-create.test.ts`<br>`server/tests/lab-02/tickets-create.db.test.ts` | PASS locally and in the isolated-PostgreSQL hosted CI step on Issue #15 baseline `82a654011a353ac95e5b676509f3d62b0bda8d26`; post-review follow-up CI and peer review pending |
| API-05 | API / Integration | FR-03–FR-04; AC-01–AC-02; AC-09; BR-01–BR-07; BR-12–BR-13 | Malformed/wrong-type JSON, missing/unknown fields, Summary/Description boundaries, invalid references/priorities, and attempted server-field overrides | Each invalid request returns `400` with documented field details, creates no ticket, rejects missing/null/wrong-case/unsupported priority, and never accepts client-controlled ownership, number, status, or timestamps | `server/tests/lab-02/tickets-create.test.ts`<br>`server/tests/lab-02/tickets-create.db.test.ts` | PASS locally and in the isolated-PostgreSQL hosted CI step on Issue #15 baseline `82a654011a353ac95e5b676509f3d62b0bda8d26`; post-review follow-up CI and peer review pending |
| API-06 | API / Integration | FR-04; AC-02; BR-01 | Sequential ticket creation, per-UTC-year sequence allocation, year rollover, and database uniqueness | Every successful number matches `TKT-YYYY-XXXXXX`, contains the expected UTC year, uses the next zero-padded yearly sequence, and is distinct with no partial database row | `server/tests/lab-02/ticket-number.test.ts`<br>`server/tests/lab-02/tickets-create.db.test.ts` | PASS locally and in the isolated-PostgreSQL hosted CI step on Issue #15 baseline `82a654011a353ac95e5b676509f3d62b0bda8d26`; post-review follow-up CI and peer review pending |
| API-07 | API / Integration | FR-05; FR-11; AC-03; AC-09; BR-12–BR-13 | `GET /api/tickets` ownership scope, minimum item schema including Requested Priority, empty result, and pagination envelope | A sees only A’s tickets and B only B’s; every item includes number, Summary, category, system, Requested Priority, status, and timestamps; totals are requester-scoped and no foreign attachment metadata leaks | `server/tests/lab-02/tickets-list.test.ts`<br>`server/tests/lab-02/tickets-list.db.test.ts` | PASS — route/service contract 14/14 and isolated PostgreSQL list integration 3/3 locally; final commit SHA, hosted CI, and peer review pending |
| API-08 | API / Integration | FR-06; FR-11; AC-04; AC-09; BR-12–BR-13 | Case-insensitive search, category/system/Requested Priority/status filters, all allowed sorts, page boundaries/sizes, and combined criteria | Criteria including each exact priority combine with AND; order/defaults are stable; no-match and beyond-last-page requests return correctly scoped empty items and totals | `server/tests/lab-02/tickets-list.test.ts`<br>`server/tests/lab-02/tickets-list.db.test.ts` | PASS — route/service contract 14/14 and isolated PostgreSQL list integration 3/3 locally, including every priority/sort/page-size value; final commit SHA, hosted CI, and peer review pending |
| API-09 | API / Integration | FR-06; AC-04; AC-09; BR-13 | Invalid list-query values including Requested Priority | Repeated/unsupported parameters, invalid/wrong-case priority, invalid sort/filter, non-integer/out-of-range page, unsupported page size, and malformed IDs return `400 INVALID_QUERY` without unrestricted fallback | `server/tests/lab-02/ticket-query.test.ts`<br>`server/tests/lab-02/tickets-list.test.ts` | PASS within the 21/21 query-normalization and 14/14 route-contract suites locally; final commit SHA, hosted CI, and peer review pending |
| API-10 | API / Integration | FR-07; FR-11; AC-05; AC-09; BR-12–BR-13 | `GET /api/tickets/:id` owner/foreign/malformed/missing outcomes and complete Ticket Detail schema | Owner receives Requested Priority, Ticket Number, `createdAt`, labels, and active/removed attachment metadata; forbidden/missing outcomes expose no data and malformed IDs return the documented validation response | `server/tests/lab-02/tickets-detail.test.ts` | Not run |
| API-11 | API / Integration | FR-08; FR-11; AC-06; BR-08–BR-10; BR-12 | Valid multipart upload to an owned ticket for each allowed file type | Each upload returns `201`, persists correct metadata/owner relation, appears active in detail, and contributes to the active-count limit | `server/tests/lab-02/attachments.test.ts` | Not run |
| API-12 | API / Integration | FR-08; AC-06; BR-08–BR-10 | Invalid multipart shape/parts, empty/overlong/control-character/path-like filenames, extension/declared-MIME mismatch, empty file, size boundary, and sequential sixth file | Safe basename input succeeds; invalid filename returns exact `400 ATTACHMENT_FILENAME_INVALID`; the exact 5 MiB limit returns `201`; every rejected request leaves no committed attachment metadata; the sequential sixth upload fails and the active count remains five | `server/tests/lab-02/attachments.test.ts` | Not run |
| API-13 | API / Integration | FR-09; FR-11; AC-07; BR-12 | Active attachment download by its owning requester | Returns `200`; bytes, MIME, and `Content-Length` match upload; `Content-Disposition` has safe ASCII/UTF-8 filename; no redirect/storage path leaks and attachment metadata is unchanged | `server/tests/lab-02/attachments-download.test.ts` | Not run |
| API-14 | API / Integration | FR-10; AC-08; BR-11 | `PATCH .../remove` with malformed JSON, unknown/missing field, whitespace, boundary-invalid, and valid reasons | Invalid input returns documented `400`; valid trimmed 5–500-character reason returns `200` and atomically stores removal flag, timestamp, reason, and remover context | `server/tests/lab-02/attachments-remove.test.ts` | Not run |
| API-15 | API / Integration | FR-07–FR-10; AC-08; BR-10–BR-11 | Removed-attachment metadata/audit retention, repeated removal, download blocking, and active-count release | Ticket Detail retains safe removed metadata and original audit fields; download and repeated removal return `404 ATTACHMENT_NOT_AVAILABLE`; the removed item no longer counts toward five active files; byte-retention policy is internal and is not asserted | `server/tests/lab-02/attachments-remove.test.ts` | Not run |
| API-16 | API / Integration | FR-08–FR-11; AC-06–AC-08; BR-12 | Cross-owner, malformed, missing, and wrong-ticket-nested attachment access for upload/download/remove | B gets `403` before child data leaks; malformed ID gets `400`; missing/wrong-ticket attachment gets `404`; no metadata/bytes leak and no file or row mutates | `server/tests/lab-02/attachments-ownership.test.ts` | Not run |
| API-17 | API / Integration | FR-12; AC-11; BR-14 | First create, identical replay, and conflicting `clientRequestId` reuse by the same or another requester | First request returns `201`/`replayed: false`; identical retry returns the same Ticket with `200`/`replayed: true`; changed normalized content or requester returns `409`; exactly one row exists | `server/tests/lab-02/ticket-service.test.ts`<br>`server/tests/lab-02/tickets-create.db.test.ts` | PASS locally and in hosted CI on Issue #15 baseline `82a654011a353ac95e5b676509f3d62b0bda8d26`; post-review follow-up CI and peer review pending |
| API-18 | API / Integration | FR-12; AC-11; BR-14 | Lost-response sequential retry using one `clientRequestId` | After discarding the first successful response, a sequential retry returns the original Ticket as a replay and the database still contains exactly one row | `server/tests/lab-02/ticket-service.test.ts`<br>`server/tests/lab-02/tickets-create.db.test.ts`<br>`client/tests/lab-02/CreateTicketPage.test.tsx` | PASS locally and in hosted CI on Issue #15 baseline `82a654011a353ac95e5b676509f3d62b0bda8d26`; post-review follow-up CI and peer review pending |
| API-19 | API / Integration | FR-07; FR-11; AC-05; BR-12 | Explicit Attachment-metadata retrieval through owned `GET /api/tickets/:id` detail | Active and removed metadata are returned in deterministic order with removal fields/downloadability, while storage keys/paths and bytes are absent; foreign/missing access follows the detail ownership contract | `server/tests/lab-02/tickets-detail.test.ts` | Not run |
| API-20 | API / Integration | FR-01–FR-03; FR-05; FR-07; FR-10–FR-12; AC-12; AC-15; BR-15 | Injected database/transaction failures on requester/reference data, create, list, detail, and removal JSON operations | Returns `500 INTERNAL_ERROR` in the documented safe envelope; no stack/SQL/Prisma/path/credential detail leaks and failed mutations leave no partial ticket, replay key, or changed removal audit | `server/tests/lab-02/internal-errors.test.ts` | Not run |
| API-21 | API / Integration | FR-08–FR-10; AC-12; AC-15; BR-08–BR-11; BR-15 | Injected upload/storage failure and pre-stream download failure | Each pre-stream failure returns the safe JSON `500 INTERNAL_ERROR`, commits no attachment metadata, returns no file bytes, and leaks no path or storage key | `server/tests/lab-02/attachment-failures.test.ts` | Not run |
| UI-01 | UI Component | FR-01; AC-10; AC-12; BR-03–BR-04 | Dedicated Development Requester Selection loading, populated, empty, and error/Retry states with dropdown and Continue | Ticket screens/shell are gated; Continue is disabled until selection; active options render; successful Continue enters the shell; empty and failure states have distinct actionable copy and no scoped request fires | `client/tests/lab-02/RequesterSelection.test.tsx`<br>`client/tests/lab-02/App.requester.test.tsx` | PASS — 7/7 locally and in hosted CI on Issue #15 baseline `82a654011a353ac95e5b676509f3d62b0bda8d26`; post-review follow-up CI and peer review pending |
| UI-02 | UI Component | FR-02; AC-01–AC-02; AC-09; AC-12; AC-14; BR-05–BR-07; BR-13 | Create fields including Requested Priority, Unicode-character boundaries, blur/submit validation, required/error accessibility, reference-data states, and read-only Ticket Number/Ticket Date/current requester presentation | Priority offers exact `LOW`/`MEDIUM`/`HIGH`; Summary/Description count Unicode code points without native UTF-16 truncation; blur and submit errors remain associated with fields; invalid submit focuses a linked summary; the `* Required` legend and `aria-required` are present; pre-create generated values and metadata recovery follow the contract | `client/tests/lab-02/CreateTicketPage.test.tsx` | Post-review local pass — 11/11 Create Ticket cases; baseline 9/9 passed in hosted CI on `82a654011a353ac95e5b676509f3d62b0bda8d26`; follow-up commit SHA/CI and peer review pending |
| UI-03 | UI Component | FR-03–FR-04; AC-01–AC-02; AC-09; AC-12; BR-01–BR-02; BR-13 | Submission payload/pending/error recovery and success presentation | Payload sends exact `requestedPriority`; busy state sends once; recoverable errors retain input; success prominently renders authoritative Ticket Number, Ticket Date from `createdAt`, priority, and `New` status | `client/tests/lab-02/CreateTicketPage.test.tsx`<br>`client/tests/lab-02/api.create-ticket.test.tsx` | PASS locally and in hosted CI on Issue #15 baseline `82a654011a353ac95e5b676509f3d62b0bda8d26`; post-review follow-up CI and peer review pending |
| UI-04 | UI Component | FR-05; AC-03; AC-09; AC-12; BR-12–BR-13 | My Tickets loading, unfiltered Empty, active-criteria No Results, retryable list/metadata errors, desktop-table, and mobile-card states | An unfiltered zero-item response selects Empty and offers Create Ticket; a zero-item response with active search/filter criteria selects No Results and offers clear/reset; list failure and filter-metadata failure are distinct and retryable; metadata failure does not masquerade as empty options or hide valid list results; populated results include priority and correct owned links | `client/tests/lab-02/MyTicketsPage.test.tsx` | PASS — 17/17 locally, including loading/Empty/No Results, safe list and metadata failure/Retry, desktop table, mobile cards, ownership reset, invalid URL recovery, and stale-response protection; follow-up commit SHA/hosted CI, responsive browser evidence, and peer review pending |
| UI-05 | UI Component | FR-06; AC-04; AC-09; BR-13 | Search/category/system/Requested Priority/status/sort/page interactions, strict URL state, and reset | Controls emit exact parameters including all priorities, criteria reset page 1, refresh/back-forward restore valid query state without putting requester ID in the URL, and returned totals/order render without stale results; invalid/repeated/unknown URL values show an explicit state and send no list request until reset | `client/tests/lab-02/MyTicketsPage.test.tsx`<br>`client/tests/lab-02/api.ticket-list.test.tsx` | PASS — My Tickets component 17/17 and API client serialization/error handling 2/2 locally, including every priority/sort/page-size option and six invalid URL-query cases; follow-up commit SHA/hosted CI, responsive browser evidence, and peer review pending |
| UI-06 | UI Component | FR-07; FR-09; FR-11; AC-05; AC-07; AC-09; AC-12; BR-11–BR-13 | Ticket Detail fields/priority/date, explicit attachment metadata, download unavailable recovery, and protected error states | Owned detail renders all read-only values; active/removed metadata differs correctly; removed/missing download refreshes metadata and announces unavailability; failure/forbidden/missing screens reveal no ticket data | `client/tests/lab-02/TicketDetailPage.test.tsx` | Not run |
| UI-07 | UI Component | FR-08; AC-06; AC-12; BR-08–BR-10 | Attachment chooser validation, user-facing 5 MB copy backed by the exact 5 MiB validation boundary, active count, and pending/success/failure states | Invalid files are explained; the control disables while busy or at five; successful metadata appears; a safe retryable failure retains eligible user-visible state and never exposes internal storage detail | `client/tests/lab-02/TicketDetailPage.test.tsx` | Not run |
| UI-08 | UI Component | FR-10; AC-08; AC-12; BR-10–BR-11 | Removal dialog/reason validation, pending/failure retention, and post-removal rendering | Invalid reason blocks submit; failure keeps the safe reason and shows an actionable error; success renders retained removed metadata, removes download/re-remove actions, announces removal, and opens one replacement slot | `client/tests/lab-02/TicketDetailPage.test.tsx` | Not run |
| UI-09 | UI Component | FR-01; AC-10; BR-03–BR-04 | Browser-tab `sessionStorage` restore and protected deep-link gating | Only an integer requester ID is stored; valid active ID restores after reload; missing/malformed/unknown/inactive values are cleared; deep links wait for revalidation and redirect to selection before owned data can render | `client/tests/lab-02/RequesterContext.test.tsx`<br>`client/tests/lab-02/App.requester.test.tsx` | Fresh local storage/revalidation pass plus `/tickets/new` to `/requester-selection` gate; browser E2E remains pending |
| UI-10 | UI Component | FR-01; FR-05; FR-07; FR-11; AC-03; AC-05; AC-10; AC-12; BR-04; BR-12 | Change Requester, mid-session `INVALID_REQUESTER_CONTEXT`, and stale-data/race protection | Change Requester or a protected request that rejects a now-inactive context clears stored A/context state, returns to Development Requester Selection without retrying A, and cancels/ignores late A responses; confirming B starts with clean page/query state | `client/tests/lab-02/RequesterContext.test.tsx`<br>`client/tests/lab-02/App.requester.test.tsx`<br>`client/tests/lab-02/MyTicketsPage.test.tsx` | PASS locally, including Issue #16 list-abort/late-response and clean-query requester-switch coverage; hosted Issue #14 baseline remains `8ef5a9c4b42fe1bf002ebed440f4109ac516ef59`, while final Issue #16 SHA/CI and peer review are pending |
| UI-11 | UI Component | FR-03; FR-12; AC-01; AC-11–AC-12; BR-14 | Logical create-attempt `clientRequestId` lifecycle, double activation, outcome-unknown/lost-response retry, replay, and `409` conflict | One UUID is generated per logical submission and reused after retryable/lost response; double activation sends once; replay renders the original Ticket; `409` shows safe blocking copy, performs no automatic retry, and never reports success; a new logical submission rotates the UUID | `client/tests/lab-02/CreateTicketPage.test.tsx` | PASS locally and in hosted CI on Issue #15 baseline `82a654011a353ac95e5b676509f3d62b0bda8d26`; post-review follow-up CI and peer review pending |
| UI-12 | UI Component | FR-01–FR-10; AC-14 | Programmatic names, labels, required/error associations, live regions, busy/current/sort state, and dialog semantics | Semantic queries find every control; `aria-required`, `aria-invalid`, `aria-describedby`, `aria-busy`, `aria-current`, sort state, alerts/live announcements, and named/described dialog behavior match the UI contract | `client/tests/lab-02/CreateTicketPage.test.tsx` (Create Ticket subset)<br>`client/tests/lab-02/accessibility.test.tsx` (remaining planned coverage) | PARTIAL PASS — Create Ticket required/error associations, blur behavior, error-summary focus/links, and busy/live semantics are covered locally; cross-screen/sort/dialog coverage remains `Not run` |
| UI-13 | UI Component | FR-02–FR-03; FR-05; FR-07–FR-10; AC-12; AC-15; BR-15 | Network/`500` recovery and warning presentation across requester screens | Safe actionable copy renders with Retry where appropriate; create/removal input is retained; stale/private/raw error details never render; warning states use explanatory text/icon and the documented warning tokens | `client/tests/lab-02/MyTicketsPage.test.tsx` (My Tickets subset)<br>`client/tests/lab-02/FailureStates.test.tsx` (remaining planned coverage) | PARTIAL PASS — My Tickets list and filter-metadata failures render safe distinct Retry states without raw details; cross-screen consolidated failure coverage remains `Not run` |
| RV-01 | Responsive / Visual | FR-02; AC-01–AC-02; AC-09; AC-13 | Create Ticket at desktop/tablet/mobile, including priority and Ticket Number/Date states | Layout reflows without overflow; priority remains usable; generated fields are readable; actions and validation do not overlap and mobile targets meet 44 px | `client/e2e/lab-02/responsive.spec.ts` | Not run |
| RV-02 | Responsive / Visual | FR-05–FR-06; AC-03–AC-04; AC-09; AC-12–AC-13 | My Tickets at desktop/tablet/mobile in populated, true-empty, no-results, loading, and failure states | Desktop table, contained tablet scroll, and mobile cards retain equivalent priority/data/actions; every state is readable, unclipped, and visually distinct | `client/e2e/lab-02/responsive.spec.ts` | Not run |
| RV-03 | Responsive / Visual | FR-07–FR-10; AC-05–AC-09; AC-12–AC-13 | Ticket Detail and Attachment states at desktop/tablet/mobile | Priority/date/detail and attachments reflow without overlap; filenames/reasons/errors wrap; upload/download/remove controls meet 44 px and failed/removed states remain understandable | `client/e2e/lab-02/responsive.spec.ts` | Not run |
| RV-04 | Responsive / Visual | FR-01; AC-10; AC-12–AC-13; BR-03–BR-04 | Development Requester Selection and shell requester summary/change action at all target widths | Dropdown, Continue, loading/empty/error/Retry, demo warning, current requester, and Change Requester remain visible, ordered, and usable without entering the ticket shell prematurely | `client/e2e/lab-02/responsive.spec.ts` | Local visual pass for selection and shell at 1440×900, 834×1112, and 390×844; committed browser automation remains pending |
| E2E-01 | End-to-End | FR-01–FR-10; AC-01–AC-02; AC-04; AC-06–AC-10 | Select requester A, create a priority-bearing ticket, verify Number/Date, find/filter/open it, retrieve metadata, upload/download/remove an attachment, and retry removed download | Complete workflow succeeds; priority round-trips; generated values remain read-only/`New`; removed metadata remains visible and removed download returns the documented unavailable outcome | `client/e2e/lab-02/requester-ticket-lifecycle.spec.ts` | Not run |
| E2E-02 | End-to-End | FR-05; FR-07; FR-09–FR-11; AC-03–AC-05; AC-07–AC-08; AC-10; BR-12 | Change from requester A to B and attempt list, detail, download, and removal access to A’s resources | A’s visible/cached data disappears immediately; late A responses are ignored; only B data loads; direct foreign operations use the documented `403`/`404` outcomes without returning protected content and mutate nothing | `client/e2e/lab-02/ownership-isolation.spec.ts` | Not run |
| E2E-03 | End-to-End | FR-01; AC-10; AC-12; BR-03–BR-04 | Initial/deep-link requester gate, dropdown/Continue, requester endpoint states, tab-session restore, and requester deactivation after selection | No protected request/render occurs before validation; valid selection survives reload; malformed/inactive stored context is cleared; if an active selected requester later becomes inactive, the next protected rejection clears the context and returns to selection without a retry loop | `client/e2e/lab-02/requester-context.spec.ts` | Not run |
| E2E-04 | End-to-End | FR-03; FR-12; AC-01; AC-11–AC-12; BR-14 | Create succeeds but its response is discarded, then the user retries the same logical request | Retry reuses `clientRequestId`, returns the original Ticket as replay, renders one success, and exactly one Ticket appears in list/detail; a later distinct submission uses a new ID | `client/e2e/lab-02/ticket-idempotency.spec.ts` | Not run |
| E2E-05 | End-to-End | FR-05–FR-10; AC-03–AC-08; AC-12; BR-12 | Unfiltered Empty versus active-criteria No Results plus recoverable list/detail/upload/download/remove failures | Query criteria select the correct list state; safe retries recover where offered, entered reasons/files are retained where allowed, and no stale, foreign, or internal data appears | `client/e2e/lab-02/state-recovery.spec.ts` | Not run |
| E2E-06 | End-to-End | FR-01–FR-10; AC-14 | Keyboard-only requester selection, create/list/detail, upload, and removal-dialog workflow | Focus order/indicator are logical; skip link works; every action is keyboard operable; modal traps focus, closes with Escape, and restores focus; announcements and non-color meaning are exposed | `client/e2e/lab-02/accessibility.spec.ts` | Not run |

## 3. Acceptance-Criterion Traceability Matrix

| Acceptance Criterion | Behavior Under Test | Planned Test IDs |
|---|---|---|
| AC-01 | A valid ticket can be created, while required fields and Summary/Description boundaries are enforced | UT-01, API-04, API-05, UI-02, UI-03, UI-11, RV-01, E2E-01, E2E-04 |
| AC-02 | The backend assigns an authoritative unique `TKT-YYYY-XXXXXX` number, Ticket Date, and initial status `New` | UT-02, API-04, API-05, API-06, UI-02, UI-03, RV-01, E2E-01 |
| AC-03 | My Tickets contains only the selected requester’s tickets and clears foreign/stale content on context change | UT-07, API-07, UI-04, UI-10, RV-02, E2E-02, E2E-05 |
| AC-04 | Search, Requested Priority and other filters, sorting, and pagination combine and remain requester-scoped | UT-03, API-08, API-09, UI-05, RV-02, E2E-01, E2E-02, E2E-05 |
| AC-05 | An owner can retrieve complete Ticket Detail including Attachment metadata; foreign/missing access reveals no protected data | UT-07, API-10, API-19, UI-06, UI-10, RV-03, E2E-02, E2E-05 |
| AC-06 | Allowed attachments upload within type, exact size, and active-count constraints; invalid uploads do not persist | UT-04, UT-07, API-11, API-12, API-16, UI-07, RV-03, E2E-01, E2E-05 |
| AC-07 | The owner can download an active attachment; unavailable and cross-owner access is safely denied | UT-07, API-13, API-16, UI-06, RV-03, E2E-01, E2E-02, E2E-05 |
| AC-08 | Removal requires a reason, preserves metadata, releases an active slot, and blocks future download | UT-05, UT-07, API-14, API-15, API-16, UI-08, RV-03, E2E-01, E2E-02, E2E-05 |
| AC-09 | Requested Priority is required, accepts only `LOW`/`MEDIUM`/`HIGH`, and round-trips through create, list/filter, detail, and UI | UT-01, UT-03, API-04, API-05, API-07, API-08, API-09, API-10, UI-02, UI-03, UI-04, UI-05, UI-06, RV-01, RV-02, RV-03, E2E-01 |
| AC-10 | Dedicated requester selection, tab-session restoration, protected deep-link gating, and requester switching prevent stale ownership state | API-01, API-03, UI-01, UI-09, UI-10, RV-04, E2E-01, E2E-02, E2E-03 |
| AC-11 | `clientRequestId` makes first create, sequential replay, conflict, double activation, and lost-response retry idempotent | UT-06, API-17, API-18, UI-11, E2E-04 |
| AC-12 | Loading, unfiltered Empty, active-criteria No Results, recoverable failure, and unavailable states are distinct and safely recoverable | API-01, API-02, API-20, API-21, UI-01, UI-02, UI-03, UI-04, UI-06, UI-07, UI-08, UI-10, UI-11, UI-13, RV-02, RV-03, RV-04, E2E-03, E2E-04, E2E-05 |
| AC-13 | Requester Selection, Create Ticket, My Tickets, and Ticket Detail meet the documented desktop, tablet, and mobile overflow/touch-target requirements | RV-01, RV-02, RV-03, RV-04 |
| AC-14 | Programmatic labels/relationships, keyboard operation, focus behavior, live announcements, modal behavior, and non-color meaning are verified automatically | UI-12, E2E-06 |
| AC-15 | Unexpected database/storage failures return a safe `500` envelope, leak no internals, and leave no partial state | API-20, API-21, UI-13 |

The planned matrix assigns every acceptance criterion to automated evidence rather than relying solely on manual visual review. Server-observable criteria are assigned to API/integration checks; responsive and accessibility criteria will require automated real-browser evidence; and component/E2E rows are assigned to the user-facing contract. Rows remain unverified until their individual status changes from `Not run` with recorded evidence.

### 3.1 Issue #13 database-foundation traceability

| Issue #13 Deliverable | Verification |
|---|---|
| Five models and the canonical Section 7 fields/relationships | DB-01 schema-catalog and enum assertions |
| Clean migration chain, unique/check/FK constraints, restrictive deletes, cascading key updates, and required query/FK indexes | Clean `prisma migrate deploy` result in Section 6; DB-01 applied-record, invalid-write, relation-action, and index-signature assertions |
| Deterministic seed with 4 categories, at least 6 related systems, at least 4 active requesters and 1 inactive requester; safe repeated execution | DB-01 exact fixture, stable-ID/value, active-state, and repeated-upsert assertions |

`DB-01` is foundation evidence only. It does not claim that the planned HTTP, UI, responsive, accessibility, or end-to-end behavior has been implemented.

## 4. Responsive and Visual Checklist

### 4.1 Fixed review viewports

| Target | Width Rule | Evidence Viewport | Expected Layout Mode |
|---|---:|---:|---|
| Desktop | `>= 992px` | 1440×900 | Multi-column forms/detail and full data table |
| Tablet | `768–991px` | 834×1112 | Two-column forms/detail and contained horizontally scrollable table |
| Mobile | `< 768px` | 390×844 | Vertical stack, ticket cards, and full-width touch-friendly actions |

At each viewport, check all items below and record any variance as a defect:

- [ ] Primary actions use Primary Green `#006B3C`; secondary emphasis uses `#0B7A46`.
- [ ] Pale Green `#EAF6EF`, page background `#F5F7F6`, charcoal text `#1A2E22`, error `#D32F2F`, warning `#8A5500`, and warning background `#FFF4D6` match the UI tokens without unapproved near-colors.
- [ ] Warning meaning includes readable text and/or an understandable icon; amber color alone never carries meaning.
- [ ] Editable controls are visually distinct from read-only controls shaded `#F0F4F1`.
- [ ] Required controls show an asterisk and their validation message immediately below the related input.
- [ ] Submit/upload/remove controls show busy state, disable repeat activation, and retain an understandable label.
- [ ] Keyboard focus is visible; labels are associated with controls; status/error changes are announced appropriately.
- [ ] There is no page-level horizontal overflow at the three target viewports. Only the tablet table’s labelled local scroll container may scroll horizontally.
- [ ] Mobile interactive targets are at least 44×44 CSS px and have adequate spacing.
- [ ] Long summaries, filenames, removal reasons, empty states, and validation text wrap without collision or clipping.
- [ ] Loading, empty, success, `400`, `403`, `404`, `409`, safe `500`, network-failure, and retryable states remain readable and do not expose another requester’s data.

### 4.2 Page-specific checks and screenshot evidence

| Page | Desktop Checks | Tablet Checks | Mobile Checks | Screenshot Paths | Status |
|---|---|---|---|---|---|
| Development Requester Selection | Dropdown and Continue remain grouped; loading/empty/error/Retry are distinct; ticket shell is absent before selection | Content remains centred and logical; demo warning stays adjacent to the selector | One vertical stack at 390 px; full-width controls provide at least 44 px touch targets without page overflow | `docs/lab-02/evidence/requester-selection-desktop.png`<br>`docs/lab-02/evidence/requester-selection-tablet.png`<br>`docs/lab-02/evidence/requester-selection-mobile.png` | Captured locally on 2026-08-26; automated browser assertion remains pending |
| Create Ticket | Multi-column alignment; labels and actions line up; validation does not shift unrelated fields unexpectedly | Two-column fields reflow in logical tab order | One vertical column; full-width controls/actions; keyboard does not hide the active error | `docs/lab-02/evidence/create-ticket-desktop.png`<br>`docs/lab-02/evidence/create-ticket-tablet.png`<br>`docs/lab-02/evidence/create-ticket-mobile.png` | Not captured |
| My Tickets | Full table headers/data align; sort indicator and pagination are visible | Table scroll remains inside its region; search/filter controls remain reachable | Cards replace the table; key number/status/Summary data and pagination remain visible | `docs/lab-02/evidence/my-tickets-desktop.png`<br>`docs/lab-02/evidence/my-tickets-tablet.png`<br>`docs/lab-02/evidence/my-tickets-mobile.png` | Not captured |
| Ticket Detail | Ticket information and attachment area use balanced columns; actions are unambiguous | Columns reflow without hiding metadata or actions | Single-column content; long filename/reason wraps; actions are full width and at least 44 px high | `docs/lab-02/evidence/ticket-detail-desktop.png`<br>`docs/lab-02/evidence/ticket-detail-tablet.png`<br>`docs/lab-02/evidence/ticket-detail-mobile.png` | Not captured |

Capture screenshots with deterministic fixture data and no browser extensions, personal information, debug overlays, or secrets visible. A screenshot is supporting evidence, not a substitute for the automated assertions in `RV-01`–`RV-04`. The four screens require twelve baseline desktop/tablet/mobile screenshots; validation, empty, failure, and warning captures supplement them.

## 5. Test Commands

Run commands from the repository root (`toktickit/`) unless stated otherwise.

### 5.1 Install and prepare a disposable test database

```powershell
npm --prefix server ci
npm --prefix client ci

# Supply a disposable database or a test-marked isolated schema explicitly.
$env:TEST_DATABASE_URL = "postgresql://<user>:<password>@<host>:5432/toktickit_test?schema=public"
$developmentDatabaseUrl = $env:DATABASE_URL
$env:DATABASE_URL = $env:TEST_DATABASE_URL
& server/node_modules/.bin/prisma.cmd migrate deploy --schema server/prisma/schema.prisma
npm --prefix server run prisma:seed
$env:DATABASE_URL = $developmentDatabaseUrl
```

`TEST_DATABASE_URL` must target a different database/schema from `DATABASE_URL`, use PostgreSQL, and include a delimited `test`, `testing`, `ci`, or `spec` segment in the database/schema name (for example, `toktickit_test` or `pr21_test_run`). The Vitest setup rejects any other target. Do not reset or clean a shared development/production database.

### 5.2 Run automated tests

```powershell
# DB-free server unit project
npm --prefix server run test:unit

# Implemented Issue #13 database integration suite
npm --prefix server run test:db

# Lab 2 server unit/API tests only
npm --prefix server test -- tests/lab-02

# Lab 2 client component tests only
npm --prefix client test -- tests/lab-02

# Complete regression suites, including Lab 1
npm --prefix server test
npm --prefix client test
```

These commands are backed by the existing `test: vitest run` scripts and current Vitest include patterns.

### 5.3 Build verification

```powershell
npm --prefix server run build
npm --prefix client run build
```

### 5.4 Browser E2E and responsive suite

The following is the planned command after an implementation issue adds `@playwright/test`, `client/playwright.config.ts`, browser binaries, and a `test:e2e` package script:

```powershell
npm --prefix client run test:e2e
```

It is **not runnable in the current repository** and must not be reported as passed until that configuration is committed. Until then, start the two development processes in separate terminals for manual responsive review:

```powershell
npm --prefix server run dev
```

```powershell
npm --prefix client run dev
```

## 6. Current Verification Results

**Overall result:** `PARTIAL PASS — ISSUES #13–#16 HAVE LOCAL AUTOMATED EVIDENCE FOR THEIR IMPLEMENTED SLICES; DEFERRED LAB 2 ROWS RETAIN THEIR INDIVIDUAL NOT RUN STATUS`

| Item | Result |
|---|---|
| Commit SHA tested | Issue #13 evidence: `c09c6549833aac114e40fc5ecfa8c6a1308277ec`. Issue #14 hosted baseline: `8ef5a9c4b42fe1bf002ebed440f4109ac516ef59`. Issue #15 hosted baseline: `82a654011a353ac95e5b676509f3d62b0bda8d26`. Issue #16 hosted baseline: `36857e27d631e19777c94662c681bfb5d5dfa543`; PR #24 review follow-up is verified in the uncommitted local `feat/my-tickets-list` working tree based on that SHA, so its final SHA and hosted CI are pending |
| Date/time and timezone | Issue #13: `2026-08-25 16:45 ICT`; Issue #14 hosted CI: `2026-08-27`; Issue #15 baseline CI checked `2026-08-29 ICT`; Issue #16 hosted baseline completed `2026-08-29 23:00 ICT`; review follow-up local rerun: `2026-08-29 23:33 ICT` (UTC+7) |
| Tester | OpenAI Codex local verification; author and peer sign-off remain pending |
| OS / Node.js / npm / PostgreSQL versions | Windows `10.0.19045`; Node.js `v24.14.0`; npm `11.9.0`; PostgreSQL `18.4` |
| Browser and version | Google Chrome `151.0.7922.174` headless for the Issue #14 selection screenshots; full browser E2E remains `Not run` |
| Database integration (`DB-01`) | Fresh run: `11 passed / 0 failed / 0 skipped` on isolated PostgreSQL database `toktickit_test` |
| Server tests | Current full suite: `103 passed / 0 failed / 0 skipped` across 14 files, including isolated PostgreSQL Create Ticket and My Tickets integration |
| Client tests | Current regression: `66 passed / 0 failed / 0 skipped` across 8 files, including 13 Create Ticket and 17 My Tickets component cases |
| E2E/responsive tests | RV-04 selection ready/pending-choice visual review passed locally at the three required viewports; RV-02 My Tickets real-browser evidence, all E2E rows, and committed responsive automation remain `Not run` |
| Server build | PASS (`tsc`) |
| Client build | PASS (`tsc && vite build`) |
| Lint | PASS for both server and client with zero warnings |
| Final release recommendation | PASS for the implemented Issue #16 backend and component scope in the local working tree. The prior PR head passed hosted CI; after committing this review follow-up, the new final SHA must pass hosted CI and peer review, and RV-02 must receive the agreed real-browser responsive evidence. Ticket Detail/**View ticket** behavior remains Issue #17 and is not claimed as passed |

| Command / Review | Timestamp | Result and Counts | Evidence Path or PR Link |
|---|---|---|---|
| Clean `prisma migrate deploy` + deterministic seed | `2026-08-25 16:45 ICT` | PASS — all 3 migrations applied from empty schema; seed reported 4 categories, 6 related systems, 5 requesters | Local terminal on disposable schema; repeat in PR CI |
| Corrective migration over supported legacy Ticket/Attachment rows | `2026-08-25 16:31 ICT` | PASS — canonical renames, synthetic UUID, uploader/remover audit backfills, active/removed state, and row contents preserved | Local SQL assertions on disposable schema; schema removed after run |
| `npm --prefix server run test:unit` without `TEST_DATABASE_URL` | `2026-08-25 16:42 ICT` | PASS — 2/2; proves DB-free tests do not require PostgreSQL setup | Local terminal |
| `npm --prefix server run test:db` | `2026-08-25 16:45 ICT` | PASS — 11/11 | `server/tests/lab-02/db-schema.test.ts`; local terminal |
| `npm --prefix server test` | `2026-08-25 16:45 ICT` | PASS — 14/14 across 3 files and both Vitest projects | Local terminal on disposable schema; repeat in PR CI |
| `npm --prefix client test` | `2026-08-25 16:29 ICT` | PASS — 5/5 across 1 file | Local terminal; repeat in PR CI |
| `npm --prefix server run build` | `2026-08-25 16:45 ICT` | PASS | Local terminal |
| `npm --prefix client run build` | `2026-08-25 16:29 ICT` | PASS | Local terminal |
| `npm --prefix server run test:unit` | `2026-08-26 18:39 ICT` | PASS — 7/7 across 2 DB-free files, including API-01 5/5 | Local terminal; no development database accessed |
| `npm --prefix client test` | `2026-08-26 18:39 ICT` | PASS — 29/29 across 4 files, including UI-01/UI-09/UI-10 component coverage | Local terminal; jsdom is not responsive evidence |
| `npm --prefix server run build` and `npm --prefix client run build` | `2026-08-26 18:39 ICT` | PASS | Local terminal |
| `npm --prefix server run lint` and `npm --prefix client run lint` | `2026-08-26 18:39 ICT` | PASS — zero warnings | Local terminal |
| Chrome responsive capture and visual review | `2026-08-26 18:50 ICT` | PASS — exact viewport metrics had `scrollWidth === innerWidth`; selection captures show a valid pending option before commit, while shell captures show stored requester `1`, read-only current requester, and visible Change Requester at all three widths | `docs/lab-02/evidence/requester-selection-*.png`<br>`docs/lab-02/evidence/requester-shell-*.png` |
| Local Issue #14 regression (`npm --prefix client test`; `npm --prefix server run test:unit`) | `2026-08-27 02:35 ICT` | PASS — client 29/29 across 4 files; DB-free server 7/7 across 2 files | Local verification commit `0454cd816bbd2c1711a32d16e4ca68f88e81b39d`; the later CI baseline is verified separately below |
| Final-tree builds, lint, Prisma validation, Prisma client generation, and diff check | `2026-08-27 02:34 ICT` | PASS — client/server builds, client/server lint with zero warnings, `prisma validate`, `prisma generate`, and `git diff --check` | Local verification of the tree subsequently committed as `8ef5a9c4b42fe1bf002ebed440f4109ac516ef59` |
| Isolated test database preparation | `2026-08-27 02:31 ICT` | PASS — local `toktickit_test` connection verified; all 3 migrations deployed from an empty database; deterministic seed reported 4 categories, 6 related systems, and 5 requesters | Local PostgreSQL test target distinct from the development database; no development rows were modified |
| Final-tree full server suite | `2026-08-27 02:32 ICT` | PASS — 19/19 across 4 files: DB-01 11/11, requester/health DB-free tests 7/7, and Lab 1 Category integration 1/1 | Local verification of the tree subsequently committed as `8ef5a9c4b42fe1bf002ebed440f4109ac516ef59` |
| Hosted CI — `Lint, build, and test` | `2026-08-27 02:47–02:48 ICT` | PASS on PR head `8ef5a9c4b42fe1bf002ebed440f4109ac516ef59` — PostgreSQL container initialization, dependency installation, Prisma validation/generation, isolated migration/seed, full server suite, client suite, server/client lint, and server/client builds all completed successfully | [GitHub Actions run 33007020946](https://github.com/L0u1sss/TokTickIT/actions/runs/33007020946)<br>[Job 98303296710](https://github.com/L0u1sss/TokTickIT/actions/runs/33007020946/job/98303296710) |
| Issue #15 full server suite | `2026-08-29 16:32 ICT` | PASS — 65/65 across 11 files, including 4/4 Create Ticket cases against PostgreSQL plus metadata/create/validation/number/idempotency route and service coverage | Local post-review `feat/create-ticket` working tree; no server implementation changed in the follow-up |
| Issue #15 full client suite | `2026-08-29 16:37 ICT` | PASS — 44/44 across 6 files, including 11/11 Create Ticket cases, Unicode code-point boundaries, blur validation, required semantics, focused/linked error summary, API client, and protected-route gating | Local post-review `feat/create-ticket` working tree; jsdom is component evidence, not responsive screenshot evidence |
| Issue #15 builds, lint, and Prisma validation | `2026-08-29 16:32–16:38 ICT` | PASS — server/client TypeScript builds, production client bundle, server/client ESLint with zero warnings, and `prisma validate` from `server/` | Local post-review `feat/create-ticket` working tree |
| Hosted CI — Issue #15 baseline `Lint, build, and test` | Checked `2026-08-29 ICT` | PASS on PR head `82a654011a353ac95e5b676509f3d62b0bda8d26` — isolated PostgreSQL preparation, dependency installation, Prisma validation/generation, full server suite, client suite, server/client lint, and server/client builds all completed successfully | [GitHub Actions run 33112120077](https://github.com/L0u1sss/TokTickIT/actions/runs/33112120077)<br>[Job 98657349149](https://github.com/L0u1sss/TokTickIT/actions/runs/33112120077/job/98657349149); post-review follow-up CI and peer review pending |
| Issue #16 focused server list verification | `2026-08-29 22:40 ICT` | PASS — UT-03/API-07–API-09 query and route suites 35/35; isolated PostgreSQL ownership/filter/pagination integration 3/3 | Local `feat/my-tickets-list` working tree based on `b2ded0b`; `server/tests/lab-02/ticket-query.test.ts`, `tickets-list.test.ts`, and `tickets-list.db.test.ts` |
| Hosted CI — Issue #16 baseline `Lint, build, and test` | `2026-08-29 22:59–23:00 ICT` | PASS on PR head `36857e27d631e19777c94662c681bfb5d5dfa543` — GitHub Actions check completed successfully | [GitHub Actions run 33261715434](https://github.com/L0u1sss/TokTickIT/actions/runs/33261715434)<br>[Job 99124681133](https://github.com/L0u1sss/TokTickIT/actions/runs/33261715434/job/99124681133); review-follow-up CI and peer approval pending |
| Issue #16 My Tickets review-follow-up verification | `2026-08-29 23:30 ICT` | PASS — My Tickets 17/17, including every priority/sort/page-size option, six strict invalid URL-query cases, distinct metadata failure, safe copy, disabled metadata filters, and Retry recovery | Local `feat/my-tickets-list` working tree based on `36857e27d631e19777c94662c681bfb5d5dfa543`; jsdom card switching is component evidence, not RV-02 real-layout evidence |
| Issue #16 full regression suites after review follow-up | `2026-08-29 23:33 ICT` | PASS — server 103/103 across 14 files; client 66/66 across 8 files; database project used isolated `TEST_DATABASE_URL` | Local terminal; follow-up commit SHA and hosted CI pending |
| Issue #16 builds, lint, Prisma validation, and diff check | `2026-08-29 23:33 ICT` | PASS — server/client builds, server/client ESLint with zero warnings, `prisma validate`, and `git diff --check` | Local `feat/my-tickets-list` working tree based on `36857e27d631e19777c94662c681bfb5d5dfa543`; line-ending notices only, no whitespace errors |
| `npm --prefix client run test:e2e` | Not run | Planned infrastructure is absent | Add Playwright/configuration in the relevant implementation issue |
| Responsive/visual review | Selection and application shell passed locally; committed browser automation remains pending | Chrome headless at 1440×900, 834×1112, and 390×844 with deterministic requester fixtures | `docs/lab-02/evidence/requester-selection-*.png` and `requester-shell-*.png` |

**Failures, flakes, deviations, and linked defects:**

- The first local `DB-01` attempt passed 10/11 and exposed an incorrect test oracle for an oversized `varchar(500)`: PostgreSQL rejected the type length before the named trim check. The test was split by enforcement layer and the clean-schema rerun passed 11/11.
- The initial local full-suite attempt was environment-blocked because the local `toktickit` test role credentials did not match `TEST_DATABASE_URL` (`P1000`). The isolated `toktickit_test` role/database was aligned without modifying development data, all migrations and deterministic seed completed, and the local rerun passed 19/19. Hosted CI then repeated isolated PostgreSQL preparation and all verification steps successfully on baseline `8ef5a9c4b42fe1bf002ebed440f4109ac516ef59`. No Issue #14 requester or database assertion failed; any evidence-only follow-up must pass CI, and peer review remains pending before merging PR #22.

**Verification sign-off:**

- Implementer: `<author review / date pending>`
- Peer reviewer: `<peer re-review / date pending>`
- Evidence reviewed: Local automated output, CI baseline SHA, and successful GitHub Actions run recorded above; peer review pending

## 7. Known Limitations and Deferred Tests

- **Authentication and login security are intentionally excluded.** Planned requester-context tests cover only the simulated context carried by `x-requester-id`; they do not cover passwords, sessions, tokens, identity-provider integration, CSRF, or account recovery.
- **Ticket list navigation is delivered; Ticket Detail remains deferred.** Issue #16 adds functional **Create Ticket** and **My Tickets** navigation with non-color active-page indication and responsive mobile treatment. My Tickets renders canonical `/tickets/:id` links, while the owned Ticket Detail screen behind those links remains assigned to Issue #17.
- **Requester-protected list routing is delivered; Ticket Detail routing remains deferred.** `/tickets/new` and `/tickets` both wait for a revalidated requester context, while `/requester-selection` remains the gate. `/tickets/:id` implementation and its protected outcomes remain Issue #17.
- **Create Ticket Cancel is delivered; View ticket remains sequenced with its destination.** Issue #16 adds **Cancel**, returning a clean form directly to My Tickets and requiring confirmation before discarding a changed draft. **View ticket** after creation remains planned for Issue #17 and must not be reported as passed yet.
- **IT Staff workflows are intentionally excluded.** Assignment, staff queues, prioritization, status transitions beyond initial `New`, internal notes, and staff authorization are deferred.
- **Public comments and status progression beyond `New` are out of Lab 2 scope.** No tests should imply those features exist.
- **Browser automation is planned but not installed in the current repository.** `RV-01`–`RV-03` and every `E2E-*` row remain `Not run`. `RV-04` has local screenshot/checklist evidence only; its automated Playwright run remains pending until the dependency, configuration, browser binaries, and package script are reviewed and added.
- **Visual comparison is environment-sensitive.** Fixed viewport screenshots and checklist review are required initially; pixel-diff thresholds/baselines may be added after the UI stabilizes.
- **Load, stress, penetration, malware-scanning, and object-storage failover tests are deferred.** Planned functional tests will still need to enforce documented file type, size, count, ownership, removal, and download behavior.
- **Compatibility beyond the browser selected in final evidence is not claimed.** Add Chromium/Firefox/WebKit coverage if the course or product support matrix later requires it.
