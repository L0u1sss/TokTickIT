# Lab 2 — Test Plan and Verification Evidence

**Document status:** Planned for Issue 1 (specification only; no Lab 2 application or test implementation is claimed here)

**Related documents:** [Engineering Specification](./specification.md) · [API Specification](./api-spec.md) · [UI Specification](./ui-spec.md)

The purpose of this plan is to turn FR-01–FR-11, BR-01–BR-12, and AC-01–AC-08 into executable checks before application implementation begins. Every `Not run` entry is intentionally a TDD placeholder, not evidence of a pass.

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
| Unit | Vitest in Node.js | Validate ticket fields, ticket-number rules, list-query normalization, attachment rules, and soft-removal transitions | Pure functions/services; no HTTP, file-system, or database dependency |
| API / Integration | Vitest + Supertest against the Express app, Prisma, and a dedicated PostgreSQL test database | Verify routes, headers, status codes, response bodies, persistence, unique constraints, pagination, attachment state, and ownership enforcement | Reset or transaction-isolate fixtures between tests; never use shared development data |
| UI Component | Vitest + jsdom + React Testing Library + `user-event` with mocked API calls | Verify rendered content, accessible controls, validation placement, loading/disabled states, list interactions, and error handling | One page/component at a time; API module mocked at the network boundary |
| Responsive / Visual | Browser automation at fixed viewports plus human screenshot review | Verify actual CSS layout, breakpoints, overflow, card/table switching, Zen Green tokens, and 44 px touch targets | Deterministic seed data and fixed desktop/tablet/mobile viewports |
| End-to-End | Planned Playwright browser suite against running client/server and a disposable seeded database | Verify a requester can complete the ticket and attachment lifecycle and cannot access another requester’s data | Fresh database state per run; two active requesters and one inactive requester |

The repository currently has Vitest configured for `server/tests/**/*.test.ts` and `client/tests/**/*.test.tsx`. Supertest and React Testing Library are already installed. No Playwright/Cypress dependency, configuration, or `test:e2e` script exists yet; those are planned test infrastructure for an implementation issue and are not silently assumed to be runnable in Issue 1.

### 1.3 Fixtures, controls, and test oracles

- Use three deterministic requester fixtures: active requester A, active requester B, and inactive requester C. A and B must have distinguishable tickets; C must never appear in the requester selector.
- Seed at least two active categories and two active related systems, plus inactive metadata records, so filters and active-reference validation prove inclusion and exclusion rather than merely render a non-empty list.
- Freeze the clock for ticket-number tests. Assert the full `^TKT-[0-9]{4}-[0-9]{6}$` format, the expected creation year, and database-backed uniqueness; do not assert only a prefix.
- Interpret the 5 MB attachment limit as 5 MiB (`5,242,880` bytes): the exact limit is accepted and one byte over is rejected. Construct boundary buffers during the test instead of committing large binaries.
- Keep small, inert JPG, PNG, WEBP, PDF, and disallowed text fixtures under `server/tests/lab-02/fixtures/`. Never use personal or confidential files.
- Test Summary at 4, 5, 120, and 121 trimmed Unicode characters, and Description at 9, 10, 2,000, and 2,001 trimmed Unicode characters. Whitespace-only input is invalid.
- Test attachment-removal reason at 4, 5, 500, and 501 trimmed characters. Whitespace-only input is invalid.
- For each rejected create, upload, or removal request, assert both the error response and the absence of an unintended database/file mutation.
- Ownership tests must use the same ticket or attachment identifier first as its owner and then as requester B. A filtered list alone is insufficient evidence because direct-object access must also be protected.
- Pagination tests cover the allowed page sizes `10`, `20`, and `50`, the default page size `10`, and the default sort `createdAt desc`. They use stable seed timestamps and a deterministic tie-breaker so results cannot move between pages when the primary sort values are equal.
- API assertions cover the exact status, documented JSON schema/error code, relevant headers, and persisted state. Download tests additionally compare bytes, MIME type, and `Content-Disposition`.
- UI component tests do not count as responsive evidence: jsdom does not perform real layout. Breakpoint, overflow, pixel size, and screenshot checks run in a real browser.

## 2. Planned Tests

All paths below are repository-relative planned locations. Test files will be added during later TDD implementation work; this Issue 1 document does not create them.

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File Path | Final Status |
|---|---|---|---|---|---|---|
| UT-01 | Unit | FR-02; AC-01; BR-05–BR-07 | Trimming, required values, and boundary values for Summary (5–120), Description (10–2,000), category, and related system | Boundary-valid input passes; missing, whitespace-only, too-short, too-long, or inactive/nonexistent-reference input returns a field-specific validation result | `server/tests/lab-02/ticket-validation.test.ts` | Not run |
| UT-02 | Unit | FR-04; AC-02; BR-01–BR-02 | Ticket-number construction with a fixed clock and six-digit sequence | Value matches `TKT-YYYY-XXXXXX`, contains the creation year and zero-padded six-digit suffix; initial status is `New` | `server/tests/lab-02/ticket-number.test.ts` | Not run |
| UT-03 | Unit | FR-06; AC-04 | Search trimming, permitted filters/sorts, default `createdAt desc`, page bounds, allowed page sizes 10/20/50 (default 10), and stable secondary sort | Valid values normalize predictably; unsupported sort/filter or invalid page/page-size values produce a validation error | `server/tests/lab-02/ticket-query.test.ts` | Not run |
| UT-04 | Unit | FR-08; AC-06; BR-08–BR-10 | Allowed extension/MIME pairs, exact-size boundary, one-byte-over boundary, and active-attachment count | Allowed JPG/PNG/WEBP/PDF at or below 5 MiB passes; mismatched/disallowed type, oversized file, or sixth active attachment fails | `server/tests/lab-02/attachment-validation.test.ts` | Not run |
| UT-05 | Unit | FR-10; AC-08; BR-11 | Removal-reason validation and transition from active to removed | Reason of 5–500 trimmed characters succeeds; invalid reason fails; success records removed flag/time/reason, retains metadata/storage reference, and makes the attachment non-downloadable | `server/tests/lab-02/attachment-removal.test.ts` | Not run |
| API-01 | API / Integration | FR-01; BR-03–BR-04 | `GET /api/requesters` requester-selection data and public-route header behavior | Returns `200`; only active requesters are present, inactive requester C is absent, no header is required, and a supplied requester header is ignored | `server/tests/lab-02/requesters.test.ts` | Not run |
| API-02 | API / Integration | FR-02; BR-07 | `GET /api/metadata` category/related-system contract and public-route header behavior | Returns `200` with documented arrays and no inactive options; no header is required and a supplied requester header is ignored | `server/tests/lab-02/metadata.test.ts` | Not run |
| API-03 | API / Integration | FR-01; FR-11; BR-03–BR-04; BR-12 | Simulated requester-header validation on protected endpoints | Missing, malformed, or repeated `x-requester-id`, and unknown/inactive requester context return `400`; the documented error code is returned and no operation occurs | `server/tests/lab-02/requester-context.test.ts` | Not run |
| API-04 | API / Integration | FR-03–FR-04; AC-01–AC-02; BR-01–BR-07 | Valid `POST /api/tickets` for requester A | Returns `201` and `Location`; record is owned by A, has a server-generated unique number, status `New`, supplied trimmed fields, empty attachments, and creation timestamps | `server/tests/lab-02/tickets-create.test.ts` | Not run |
| API-05 | API / Integration | FR-03–FR-04; AC-01–AC-02; BR-01–BR-07; BR-12 | Malformed/wrong-type JSON, missing/unknown fields, Summary/Description boundaries, inactive/nonexistent metadata, and attempted `requesterId`/`ticketNumber`/`status` overrides | Each invalid request returns `400` with the documented code/field details, creates no ticket, and never accepts client-controlled ownership, number, or status | `server/tests/lab-02/tickets-create.test.ts` | Not run |
| API-06 | API / Integration | FR-04; AC-02; BR-01 | Concurrent ticket creation, per-UTC-year sequence allocation, and database uniqueness | Every request in a fixed concurrent batch returns `201`; every number has the expected UTC year/pattern and is distinct with no duplicate database row | `server/tests/lab-02/tickets-create.test.ts` | Not run |
| API-07 | API / Integration | FR-05; FR-11; AC-03; BR-12 | `GET /api/tickets` ownership scope, minimum item schema, empty result, and pagination envelope | Returns `200`; A sees only A’s tickets with number/Summary/category/system/status/time, B sees only B’s, no foreign attachment metadata leaks, and totals count only the current requester’s rows | `server/tests/lab-02/tickets-list.test.ts` | Not run |
| API-08 | API / Integration | FR-06; FR-11; AC-04; BR-12 | Case-insensitive number/Summary search, blank search, category/system/status filters, all allowed sorts, page boundaries, page sizes 10/20/50, and combined criteria | Returns `200`; criteria combine with AND, order is stable, defaults are `createdAt desc`/size 10, metadata is correct, and no-match or beyond-last-page requests return scoped empty items | `server/tests/lab-02/tickets-list.test.ts` | Not run |
| API-09 | API / Integration | FR-06; AC-04 | Invalid list-query values | Repeated/unsupported parameters, invalid sort/filter, non-integer or out-of-range page, unsupported page size (for example 25), and malformed identifier return `400 INVALID_QUERY` | `server/tests/lab-02/tickets-list.test.ts` | Not run |
| API-10 | API / Integration | FR-07; FR-11; AC-05; BR-12 | `GET /api/tickets/:id` for owner, other requester, malformed ID, and nonexistent ID | Owner receives `200` with complete labels/timestamps and active/removed attachment metadata; B receives `403` without data; malformed ID gets `400`; missing ID gets `404` | `server/tests/lab-02/tickets-detail.test.ts` | Not run |
| API-11 | API / Integration | FR-08; FR-11; AC-06; BR-08–BR-10; BR-12 | Valid multipart upload to an owned ticket for each allowed file type | Each upload returns `201`, persists correct metadata/owner relation, appears active in detail, and contributes to the active-count limit | `server/tests/lab-02/attachments.test.ts` | Not run |
| API-12 | API / Integration | FR-08; AC-06; BR-08–BR-10 | Invalid multipart shape/parts, extension/MIME/signature mismatch, empty file, size boundary, sequential sixth file, and competing uploads at the limit | Exact limit returns `201`; invalid/sequential-sixth returns documented `400` with no orphan; from four active files exactly one of two competing valid uploads succeeds and final active count is five | `server/tests/lab-02/attachments.test.ts` | Not run |
| API-13 | API / Integration | FR-09; FR-11; AC-07; BR-12 | Active attachment download by its owning requester | Returns `200`; bytes, MIME, and `Content-Length` match upload; `Content-Disposition` has safe ASCII/UTF-8 filename; no redirect/storage path leaks and metadata is unchanged | `server/tests/lab-02/attachments-download.test.ts` | Not run |
| API-14 | API / Integration | FR-10; AC-08; BR-11 | `PATCH .../remove` with malformed JSON, unknown/missing field, whitespace, boundary-invalid, and valid reasons | Invalid input returns documented `400`; valid trimmed 5–500-character reason returns `200` and stores removal flag, timestamp, reason, and remover context atomically | `server/tests/lab-02/attachments-remove.test.ts` | Not run |
| API-15 | API / Integration | FR-07–FR-10; AC-08; BR-10–BR-11 | Removed-attachment retention, repeated removal, download blocking, and active-count release | Detail retains metadata/storage reference; download and repeated removal return `404 ATTACHMENT_NOT_AVAILABLE`; original audit fields are unchanged; removed item no longer counts toward five active files | `server/tests/lab-02/attachments-remove.test.ts` | Not run |
| API-16 | API / Integration | FR-08–FR-11; AC-06–AC-08; BR-12 | Cross-owner, malformed, missing, and wrong-ticket-nested attachment access for upload/download/remove | B gets `403` before child data leaks; malformed ID gets `400`; missing/wrong-ticket attachment gets `404`; no metadata/bytes leak and no file or row mutates | `server/tests/lab-02/attachments-ownership.test.ts` | Not run |
| UI-01 | UI Component | FR-01; BR-03–BR-04 | Requester-selector loading/error states, active options, context sent with subsequent calls, and requester switch/clear behavior | Only active requesters render; selection is required; protected requests use the selection; switching/clearing immediately clears prior owned data before fetching; errors are actionable | `client/tests/lab-02/RequesterContext.test.tsx` | Not run |
| UI-02 | UI Component | FR-02; AC-01; BR-05–BR-07 | Create-form labels, required asterisks, editable/read-only styling hooks, and immediate field-level validation | Messages render directly below invalid controls; valid boundaries clear errors; read-only controls cannot be edited | `client/tests/lab-02/CreateTicketPage.test.tsx` | Not run |
| UI-03 | UI Component | FR-03–FR-04; AC-01–AC-02; BR-01–BR-02 | Submission payload, pending state, double-submit prevention, error recovery, and success result | Submit becomes busy/disabled and sends once; API errors preserve input; success shows generated number and `New` state | `client/tests/lab-02/CreateTicketPage.test.tsx` | Not run |
| UI-04 | UI Component | FR-05; AC-03; BR-12 | My Tickets loading, empty, error, desktop-table data, and mobile-card data | Each state is explicit; only the API’s owner-scoped records render; ticket links use the correct IDs | `client/tests/lab-02/MyTicketsPage.test.tsx` | Not run |
| UI-05 | UI Component | FR-06; AC-04 | Search/filter/sort/page interactions and reset behavior | Controls generate documented query parameters, reset page when criteria change, and render returned totals/order without stale results | `client/tests/lab-02/MyTicketsPage.test.tsx` | Not run |
| UI-06 | UI Component | FR-07; FR-09; FR-11; AC-05; AC-07; BR-11–BR-12 | Ticket-detail fields, attachment states, owner download action, and `403`/`404` screens | Owned detail renders; active attachment exposes download; removed attachment does not; forbidden and missing states do not reveal ticket data | `client/tests/lab-02/TicketDetailPage.test.tsx` | Not run |
| UI-07 | UI Component | FR-08; AC-06; BR-08–BR-10 | Attachment-chooser validation, active-count display, upload pending state, and API rejection | Invalid files are explained before/after request as applicable; upload control disables while busy and at five active files; successful metadata appears | `client/tests/lab-02/TicketDetailPage.test.tsx` | Not run |
| UI-08 | UI Component | FR-10; AC-08; BR-10–BR-11 | Removal confirmation/reason control and post-removal rendering | Invalid reason blocks submit; success marks item removed, displays retained metadata, removes download action, and permits a replacement upload slot | `client/tests/lab-02/TicketDetailPage.test.tsx` | Not run |
| RV-01 | Responsive / Visual | FR-02; AC-01 | Create Ticket at 1440×900, 834×1112, and 390×844 | Desktop uses multi-column grid, tablet uses two columns, mobile stacks vertically; no viewport overflow and touch targets are at least 44 px | `client/e2e/lab-02/responsive.spec.ts` | Not run |
| RV-02 | Responsive / Visual | FR-05–FR-06; AC-03–AC-04 | My Tickets at all three target viewports | Desktop uses table, tablet table scroll is contained, mobile uses cards; controls remain usable and content is not clipped | `client/e2e/lab-02/responsive.spec.ts` | Not run |
| RV-03 | Responsive / Visual | FR-07–FR-10; AC-05–AC-08 | Ticket Detail at all three target viewports | Detail and attachments reflow without overlap; filenames/reasons wrap safely; upload/download/remove controls meet the 44 px target | `client/e2e/lab-02/responsive.spec.ts` | Not run |
| E2E-01 | End-to-End | FR-01–FR-10; AC-01–AC-02; AC-04; AC-06–AC-08 | Requester A creates a ticket, finds and opens it, uploads/downloads an attachment, removes it with a reason, and tries to download it again | Complete workflow succeeds; generated ticket remains `New`; removed metadata remains visible and the removed download returns `404` | `client/e2e/lab-02/requester-ticket-lifecycle.spec.ts` | Not run |
| E2E-02 | End-to-End | FR-05; FR-07; FR-09–FR-11; AC-03–AC-05; AC-07–AC-08; BR-12 | Switch from requester A to B and attempt list, detail, download, and removal access to A’s resources | A’s data is absent from B’s list; direct operations return `403`; nonexistent-resource controls return `404`; no protected data is rendered | `client/e2e/lab-02/ownership-isolation.spec.ts` | Not run |

## 3. Acceptance-Criterion Traceability Matrix

| Acceptance Criterion | Behavior Under Test | Planned Test IDs |
|---|---|---|
| AC-01 | A valid ticket can be created, while required fields and Summary/Description boundaries are enforced | UT-01, API-04, API-05, UI-02, UI-03, E2E-01 |
| AC-02 | The backend assigns a unique `TKT-YYYY-XXXXXX` number and initial status `New`, and rejects client control of those fields | UT-02, API-04, API-05, API-06, UI-03, E2E-01 |
| AC-03 | My Tickets contains only the selected requester’s tickets | API-07, UI-04, RV-02, E2E-02 |
| AC-04 | Search, filters, sorting, and pagination can be combined and remain requester-scoped | UT-03, API-08, API-09, UI-05, RV-02, E2E-01 |
| AC-05 | An owner can view ticket detail; another requester cannot | API-10, UI-06, RV-03, E2E-02 |
| AC-06 | Allowed attachments upload within type, size, and active-count constraints; invalid uploads do not persist | UT-04, API-11, API-12, API-16, UI-07, RV-03, E2E-01 |
| AC-07 | The owner can download an active attachment; cross-owner access is denied | API-13, API-16, UI-06, RV-03, E2E-01, E2E-02 |
| AC-08 | Removal requires a reason, preserves metadata/storage reference, releases an active slot, and blocks future download | UT-05, API-14, API-15, API-16, UI-08, RV-03, E2E-01, E2E-02 |

No acceptance criterion relies solely on a manual visual check. Each has at least one API/integration test; responsive and E2E checks add user-facing evidence.

## 4. Responsive and Visual Checklist

### 4.1 Fixed review viewports

| Target | Width Rule | Evidence Viewport | Expected Layout Mode |
|---|---:|---:|---|
| Desktop | `>= 992px` | 1440×900 | Multi-column forms/detail and full data table |
| Tablet | `768–991px` | 834×1112 | Two-column forms/detail and contained horizontally scrollable table |
| Mobile | `< 768px` | 390×844 | Vertical stack, ticket cards, and full-width touch-friendly actions |

At each viewport, check all items below and record any variance as a defect:

- [ ] Primary actions use Primary Green `#006B3C`; secondary emphasis uses `#0B7A46`.
- [ ] Pale Green `#EAF6EF`, page background `#F5F7F6`, charcoal text `#1A2E22`, and error `#D32F2F` match the UI tokens without unapproved near-colors.
- [ ] Editable controls are visually distinct from read-only controls shaded `#F0F4F1`.
- [ ] Required controls show an asterisk and their validation message immediately below the related input.
- [ ] Submit/upload/remove controls show busy state, disable repeat activation, and retain an understandable label.
- [ ] Keyboard focus is visible; labels are associated with controls; status/error changes are announced appropriately.
- [ ] There is no page-level horizontal overflow at the target width. Only the tablet table’s local scroll container may scroll horizontally.
- [ ] Mobile interactive targets are at least 44×44 CSS px and have adequate spacing.
- [ ] Long summaries, filenames, removal reasons, empty states, and validation text wrap without collision or clipping.
- [ ] Loading, empty, success, `400`, `403`, `404`, and retryable API-error states remain readable and do not expose another requester’s data.

### 4.2 Page-specific checks and screenshot evidence

| Page | Desktop Checks | Tablet Checks | Mobile Checks | Screenshot Paths | Status |
|---|---|---|---|---|---|
| Create Ticket | Multi-column alignment; labels and actions line up; validation does not shift unrelated fields unexpectedly | Two-column fields reflow in logical tab order | One vertical column; full-width controls/actions; keyboard does not hide the active error | `docs/lab-02/evidence/create-ticket-desktop.png`<br>`docs/lab-02/evidence/create-ticket-tablet.png`<br>`docs/lab-02/evidence/create-ticket-mobile.png` | Not captured |
| My Tickets | Full table headers/data align; sort indicator and pagination are visible | Table scroll remains inside its region; search/filter controls remain reachable | Cards replace the table; key number/status/Summary data and pagination remain visible | `docs/lab-02/evidence/my-tickets-desktop.png`<br>`docs/lab-02/evidence/my-tickets-tablet.png`<br>`docs/lab-02/evidence/my-tickets-mobile.png` | Not captured |
| Ticket Detail | Ticket information and attachment area use balanced columns; actions are unambiguous | Columns reflow without hiding metadata or actions | Single-column content; long filename/reason wraps; actions are full width and at least 44 px high | `docs/lab-02/evidence/ticket-detail-desktop.png`<br>`docs/lab-02/evidence/ticket-detail-tablet.png`<br>`docs/lab-02/evidence/ticket-detail-mobile.png` | Not captured |

Capture screenshots with deterministic fixture data and no browser extensions, personal information, debug overlays, or secrets visible. A screenshot is supporting evidence, not a substitute for the automated assertion in `RV-01`–`RV-03`.

## 5. Test Commands

Run commands from the repository root (`toktickit/`) unless stated otherwise.

### 5.1 Install and prepare a disposable test database

```powershell
npm --prefix server ci
npm --prefix client ci
npm --prefix server run prisma:migrate
npm --prefix server run prisma:seed
```

Before the Prisma commands, set `server/.env` to a dedicated, disposable PostgreSQL test database. Do not reset or clean a shared development/production database. Lab 2 migrations and seed fixtures will be added during implementation.

### 5.2 Run automated tests

```powershell
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

It is **not runnable in the current Issue 1 repository** and must not be reported as passed until that configuration is committed. Until then, start the two development processes in separate terminals for manual responsive review:

```powershell
npm --prefix server run dev
```

```powershell
npm --prefix client run dev
```

## 6. Final Results (Complete After Implementation)

**Overall result:** `NOT EXECUTED — ISSUE 1 DOCUMENTATION ONLY`

| Item | Result |
|---|---|
| Commit SHA tested | `<commit-sha>` |
| Date/time and timezone | `<YYYY-MM-DD HH:mm TZ>` |
| Tester | `<name>` |
| OS / Node.js / npm / PostgreSQL versions | `<versions>` |
| Browser and version | `<browser/version>` |
| Server tests | `<passed> passed / <failed> failed / <skipped> skipped` |
| Client tests | `<passed> passed / <failed> failed / <skipped> skipped` |
| E2E/responsive tests | `<passed> passed / <failed> failed / <skipped> skipped` |
| Server build | `<PASS/FAIL>` |
| Client build | `<PASS/FAIL>` |
| Final release recommendation | `<PASS / FAIL / PASS WITH APPROVED LIMITATIONS>` |

| Command / Review | Timestamp | Result and Counts | Evidence Path or PR Link |
|---|---|---|---|
| `npm --prefix server test` | `<timestamp>` | `<result>` | `<terminal log or CI URL>` |
| `npm --prefix client test` | `<timestamp>` | `<result>` | `<terminal log or CI URL>` |
| `npm --prefix server run build` | `<timestamp>` | `<result>` | `<terminal log or CI URL>` |
| `npm --prefix client run build` | `<timestamp>` | `<result>` | `<terminal log or CI URL>` |
| `npm --prefix client run test:e2e` | `<timestamp>` | `<result>` | `<HTML report or CI URL>` |
| Responsive/visual review | `<timestamp>` | `<result>` | `docs/lab-02/evidence/` |

**Failures, flakes, deviations, and linked defects:**

- `<None yet — record test ID, observed result, expected result, defect/PR link, owner, and disposition.>`

**Verification sign-off:**

- Implementer: `<name / date>`
- Peer reviewer: `<name / date>`
- Evidence reviewed: `<yes/no>`

## 7. Known Limitations and Deferred Tests

- **Authentication and login security are intentionally excluded.** Tests verify only the simulated requester context carried by `x-requester-id`; they do not cover passwords, sessions, tokens, identity-provider integration, CSRF, or account recovery.
- **IT Staff workflows are intentionally excluded.** Assignment, staff queues, prioritization, status transitions beyond initial `New`, internal notes, and staff authorization are deferred.
- **Public comments and status progression beyond `New` are out of Lab 2 scope.** No tests should imply those features exist.
- **Browser automation is planned but not installed in Issue 1.** `RV-*` and `E2E-*` remain `Not run` until the Playwright dependency, configuration, browser binaries, and package script are reviewed and added.
- **Visual comparison is environment-sensitive.** Fixed viewport screenshots and checklist review are required initially; pixel-diff thresholds/baselines may be added after the UI stabilizes.
- **Load, stress, penetration, malware-scanning, and object-storage failover tests are deferred.** Functional tests still enforce documented file type, size, count, ownership, removal, and download behavior.
- **Compatibility beyond the browser selected in final evidence is not claimed.** Add Chromium/Firefox/WebKit coverage if the course or product support matrix later requires it.
