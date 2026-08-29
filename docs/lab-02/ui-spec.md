# Lab 02 UI Specification — Requester Ticketing MVP

| Item | Value |
|---|---|
| Product | TokTickIT requester portal |
| Sprint | Lab 02 — Issue 1 |
| Status | Implementation contract |
| UI theme | Zen Green |
| Related documents | [Sprint specification](./specification.md), [API contract](./api-spec.md), [test plan](./tests.md) |

This document defines the testable visual and interaction contract for the Lab 02 requester experience. Normative words such as **must**, **must not**, and **should** are intentional. This issue produces documentation only; application implementation is out of scope.

## 1. Experience Goals and Boundaries

The UI must let a requester:

1. choose an active requester as a simulated login context;
2. create a ticket;
3. find and inspect only that requester's tickets; and
4. upload, download, and soft-remove attachments on an owned ticket.

The experience should feel calm, compact, and task-focused. Pale surfaces, restrained green accents, plain language, and generous spacing are preferred over decoration.

The UI must not expose controls for real authentication, IT Staff workflows, public comments, assignment, or status changes. In this sprint, ticket status is read-only and remains **New**.

## 2. Information Architecture and Requester Context

### 2.1 Primary screens

| Screen | Target route | Primary purpose | Primary action |
|---|---|---|---|
| Development Requester Selection | `/requester-selection` | Establish the Lab 2 requester context before entering the application | **Continue** |
| Create Ticket | `/tickets/new` | Submit a new request | **Create ticket** |
| My Tickets | `/tickets` | Search and browse owned tickets | Open a ticket |
| Ticket Detail | `/tickets/:id` | Read one owned ticket and manage its attachments | **Upload attachment** |

Development Requester Selection is the entry gate. The Create Ticket, My Tickets, and Ticket Detail screens form the requester-facing application and must not render requester-owned content until a valid requester context has been established.

After selection, the application header must contain the TokTickIT product name, navigation links for **Create Ticket** and **My Tickets**, the current requester as a read-only **Viewing as {requesterName}** value, and a **Change Requester** action. It must not expose an immediately editable requester dropdown in the application shell. The active navigation item must be identifiable by text/shape or an underline in addition to color.

### 2.2 Development Requester Selection

The selection screen contains a heading **Select a Development Requester**, a visible **Demo context — not secure authentication** explanation, a labelled Development Requester dropdown, and a primary **Continue** button. Each option must provide enough visible information to distinguish the seeded requester, using display name and email. Options come from `GET /api/requesters`; only active requesters may appear.

The screen has these mutually exclusive states:

- **Loading:** show and announce **Loading requesters…**; disable both the dropdown and **Continue**.
- **Ready:** the first option is **Select a requester**; **Continue** remains disabled until the user chooses a valid active requester.
- **Empty:** when the API returns `[]`, show **No active requesters are available.**; keep **Continue** disabled and do not show an empty interactive dropdown as though selection were possible.
- **Error:** show **We couldn't load requesters.** and a **Retry** button. Retry repeats only the requester-list request and receives focus after the error is announced.

Selecting an option alone does not establish or change requester context. Activating **Continue** commits the selected requester, stores only its positive integer ID in browser-tab `sessionStorage`, and enters the requester-facing application. The stored value is testing context, not authentication. The selected requester ID is sent as the `x-requester-id` header on every ticket and attachment request.

On application start, the UI must parse the stored value strictly and confirm that it matches an active requester returned by `GET /api/requesters`. A missing, blank, malformed, zero/negative, unknown, or inactive ID is removed from `sessionStorage` before any requester-owned request or content is allowed. The user then remains on, or is redirected to, Development Requester Selection.

A direct or refreshed navigation to `/tickets`, `/tickets/new`, or `/tickets/:id` without a validated requester context must be gated and redirected to `/requester-selection`. The requested protected screen must not briefly render or start a requester-owned request before validation completes.

**Change Requester** removes the committed ID from `sessionStorage`, returns to Development Requester Selection, and immediately removes all requester-specific rendered/cached ticket and attachment data, form drafts, selected files, validation/success/failure messages, query state, and pagination state. It must cancel in-flight requester-owned requests where possible and disregard every obsolete response that completes later. A new requester is not committed until **Continue** is activated again; no prior requester content may remain visible while selecting or loading the next context.

On mobile, the selection form is a single-column surface with a full-width dropdown and **Continue** action. In the application shell, the read-only requester identity and **Change Requester** remain visible without opening a separate menu.

## 3. Zen Green Design Tokens

### 3.1 Required colors

| Token | Exact value | Required usage |
|---|---:|---|
| Primary Green | `#006B3C` | Primary buttons, selected navigation, links, focus emphasis |
| Secondary Green | `#0B7A46` | Secondary accent, hover treatment, icons |
| Pale Green | `#EAF6EF` | Informational panels, selected/hovered rows, **New** status background |
| Page Background | `#F5F7F6` | Application page background |
| Text Charcoal | `#1A2E22` | Body text, headings, labels |
| Error | `#D32F2F` | Validation text, error border/icon, destructive confirmation |
| Warning (`--color-warning`) | `#8A5500` | Warning and cautionary text/icons |
| Warning Background (`--color-warning-bg`) | `#FFF4D6` | Warning and cautionary callouts |
| Read-only Field | `#F0F4F1` | Read-only and immutable field backgrounds |
| Surface | `#FFFFFF` | Forms, cards, tables, dialogs |

Color application rules:

- Primary controls use Primary Green with white text. Secondary Green is the hover accent; hover must also change a border, underline, or elevation so color is not the only cue.
- Pale Green must use Text Charcoal or Primary Green text, never white text.
- Errors must include an icon and/or explanatory text, not a red-only indicator.
- Warnings must include explanatory text and/or an understandable icon; `--color-warning` and `--color-warning-bg` are required design tokens but must never carry meaning alone.
- Requested Priority must include the visible text **Low**, **Medium**, or **High**; color alone must not distinguish the values, and **High** is not an error state.
- Status must always include the word **New**; the green badge alone is insufficient.
- Focus indicators must be clearly visible against both white and pale surfaces. Use a 3 px Primary Green outline with at least 2 px visual separation from the component.
- Disabled content must remain readable; reduced opacity alone must not make text illegible.

### 3.2 Typography, spacing, and surfaces

- Use the application's system sans-serif stack. Body text is at least 16 px with a line height of at least 1.5.
- Each screen has one `h1`; subsections follow a logical `h2`/`h3` hierarchy.
- Use a 4 px spacing base, with common gaps of 8, 12, 16, 24, and 32 px.
- Form/card surfaces use a subtle border, modest radius, and no heavy shadow.
- Long summaries, descriptions, filenames, and requester names must wrap without causing horizontal page overflow.
- The page shell has a maximum content width of 1200 px and remains centered.

## 4. Responsive Layout Contract

The breakpoints align with the existing Bootstrap stack and are inclusive as shown.

| Viewport | Width | Global behavior | Forms and detail | My Tickets results |
|---|---:|---|---|---|
| Desktop | `>= 992px` | Centered container; 24–32 px gutters; header content on one row | Multi-column grid; detail uses a main-content column plus metadata/attachment column where useful | Semantic table; controls may share a row |
| Tablet | `768–991px` | 24 px gutters; header may wrap | Two-column field grid; full-width summary/description and action row | Table retained inside a labelled horizontal-scroll region |
| Mobile | `< 768px` | 16 px gutters; navigation and requester control wrap/stack | Single vertical stack; actions are full width | Table is replaced by one card per ticket |

Additional responsive rules:

- Development Requester Selection is centered at desktop/tablet widths and becomes a single-column, full-width form within the mobile gutters. Its dropdown, state message, **Retry**, and **Continue** must remain visible and usable at the documented desktop, tablet, and mobile targets.
- At desktop and tablet widths, Category and Related System share a row. Summary and Description span the full form width.
- At mobile width, labels remain above controls and all controls use the full available width.
- Primary buttons, icon buttons, navigation controls, file controls, pagination controls, and card links must provide a touch target of at least **44 × 44 px** on mobile.
- No screen may introduce horizontal page scrolling at the documented desktop, tablet, or mobile targets. Tablet table overflow is confined to its own scroll container.
- Responsive behavior is based on viewport width, not device detection.

## 5. Shared Component and Control States

### 5.1 Form controls

| State | Visual treatment | Behavior and accessibility |
|---|---|---|
| Editable | White background, visible neutral border, Text Charcoal | Persistent visible label; no placeholder-only labels |
| Hover | Strengthened border/accent | Cursor and visual change must match interactivity |
| Focus | 3 px Primary Green focus ring | Never remove the native/custom visible focus indication |
| Read-only | `#F0F4F1` shaded background | Remains selectable/readable; identified as read-only where not obvious |
| Required | Label followed by a visible red asterisk | A form-level note says **`* Required`**; use `aria-required="true"` |
| Invalid | Error border/icon and field message immediately below | Set `aria-invalid="true"`; associate the message using `aria-describedby` |
| Disabled | Muted but legible treatment | Native disabled semantics; do not use disabled controls to present useful read-only data |
| Busy | Button remains disabled and shows spinner plus action text such as **Creating ticket…** | Prevent duplicate requests; expose busy state with `aria-busy` and a polite live announcement |

Validation runs after a field is blurred and again on submit. A message must disappear once its condition is corrected. On an invalid submit, show a concise error summary at the top of the form, move focus to it, and link each summary item to its field. Field-level messages remain immediately below their inputs.

### 5.2 Feedback patterns

| Pattern | Contract |
|---|---|
| Loading | Use a labelled spinner or skeleton; announce loading once; do not show stale requester-owned content |
| Success | Use a concise dismissible banner and move focus to it after navigation or an asynchronous mutation |
| Warning | Use `--color-warning` on `--color-warning-bg` with explanatory text or an understandable icon; color alone never carries the meaning |
| Recoverable error | Explain what failed, retain safe user input, and offer **Retry** where the same operation can be repeated |
| Empty state | Explain whether the requester has no tickets or current filters have no matches |
| Confirmation dialog | Initial focus on the least destructive useful control; trap focus; support Escape; return focus to the trigger |
| Destructive action | Use explicit language such as **Remove attachment**, never an ambiguous **OK** |

Every API-consuming screen must define and render its loading, success where applicable, empty where a collection may be empty, validation (`400`), forbidden (`403`), missing (`404`), conflict (`409`), unexpected server (`500`), and network-failure states that the corresponding endpoint can produce. A status not defined for that endpoint need not be fabricated. Retry must preserve only safe state, use the same requester context and operation parameters, and never render stale data as current.

`400 INVALID_REQUESTER_CONTEXT` from any protected request is a context failure rather than an ordinary retryable validation error. The client must remove the stored requester ID, clear requester-owned state, cancel or disregard other requests from that context, and return to Development Requester Selection. It must not offer Retry with the rejected context.

Use human-readable error copy. Raw stack traces, internal IDs, database errors, storage paths, and another requester's content must never appear in the UI. Unexpected `500` and network failures use a safe message such as **Something went wrong. Try again.** and an operation-specific **Retry** where retry is safe.

## 6. Create Ticket Screen

### 6.1 Page structure

1. Page title: **Create Ticket**.
2. Introductory sentence explaining that the ticket starts with status **New**.
3. Ticket identity/context summary containing read-only Ticket Number, Ticket Date, and current requester values.
4. Ticket form on a white surface.
5. Primary **Create ticket** and secondary **Cancel** actions.

The form contains:

| Field | Control | Requirement and UI behavior |
|---|---|---|
| Ticket Number | Read-only output | Before creation show **Generated after creation**; after success show only the server-returned `ticket.ticketNumber` |
| Ticket Date | Read-only output | Before creation show **Set after creation**; after success show a readable date/time derived only from the server-returned `ticket.createdAt` and retain its machine-readable value |
| Requester | Read-only value from **Viewing as** | Required validated context; cannot be edited inside the form |
| Category | Select populated from metadata | Required; initial option **Select a category**; only active metadata options appear |
| Related System | Select populated from metadata | Required; initial option **Select a related system**; only active metadata options appear |
| Summary | Single-line text input | Required; trim before validation; 5–120 Unicode characters; show `current / 120` counter |
| Requested Priority | Select before creation; read-only output after success | Required; initial option **Select a requested priority**; API values are exactly `LOW`, `MEDIUM`, and `HIGH`, displayed as **Low**, **Medium**, and **High**; success uses `ticket.requestedPriority` |
| Description | Multiline textarea | Required; trim before validation; 10–2,000 Unicode characters; show `current / 2000` counter; grows to a sensible maximum without hiding the page actions |

Required validation messages are:

- **Select a category.**
- **Select a related system.**
- **Select a requested priority.**
- **Summary must be 5 to 120 characters.**
- **Description must be 10 to 2,000 characters.**

Category and Related System controls are disabled while metadata loads. If either active metadata array is empty, explain which required choices are unavailable, keep the affected control and **Create ticket** disabled, retain entered text, and do not confuse this state with an API failure. A metadata `500` or network failure shows **We couldn't load ticket options.** with **Retry**, retains safe entered values, and prevents submission.

Attachment management begins after the ticket has been created because attachment endpoints require a ticket ID. The Create Ticket screen must state: **You can add up to 5 attachments after creating the ticket.**

### 6.2 Submission behavior

- **Create ticket** is enabled when a requester exists, metadata is available, and no submission is running. Activating it runs client-side validation so untouched invalid fields receive actionable messages.
- For each logical submission, the client generates one UUID `clientRequestId` before its first request. The request contains the selected `categoryId`, `relatedSystemId`, trimmed `summary`, `requestedPriority`, trimmed `description`, and that `clientRequestId`; requester ownership still comes only from the validated requester context.
- On activation, trim text values, retain the logical submission's `clientRequestId`, disable repeat activation, preserve the button width, and show **Creating ticket…** with a spinner.
- A first-create `201` response and an idempotent-replay `200` response are both success. For `201`, announce **Ticket {ticketNumber} was created.** For a response with `replayed: true`, announce **Ticket {ticketNumber} was already created. Showing the original ticket.** Both success states show the actual `ticket.ticketNumber`, Ticket Date from `ticket.createdAt`, read-only **New** status, and a **View ticket** action; replay must not be presented as a second creation.
- A `400` response maps known validation issues to their fields and places unknown validation issues in the form error summary.
- A `409` idempotency conflict shows a safe blocking explanation and must not automatically retry or claim that a ticket was created.
- After a timeout, lost response, network failure, or retryable `500`, retain the entered values and the same `clientRequestId`. **Retry** must resend the same normalized logical submission with that ID so a server-side success whose response was lost resolves to the existing ticket rather than creating another one. Do not silently generate a replacement ID while the outcome is uncertain.
- Other failures retain entered values and show **We couldn't create your ticket. Try again.** without exposing server internals.
- **Cancel** returns to My Tickets. If the user changed a field, request confirmation before discarding the draft.

Delivery sequencing does not change those final requirements: Issue #15 intentionally left **Cancel** and **View ticket** unrendered until their real destinations existed. Issue #16 delivered **Cancel** with `/tickets` and dirty-draft confirmation; Issue #17 now delivers **View ticket** with the protected `/tickets/:id` destination. Hosted CI, peer approval, and browser evidence are tracked separately in `tests.md` and must not be inferred from implementation status alone.

Ticket Number and Ticket Date are server-controlled. Before success the UI must show only their read-only placeholders; it must not predict, client-generate, or submit either value. After success, the visible values must come from the response's `ticket.ticketNumber` and `ticket.createdAt`. Dates use a consistent readable format and semantic `<time datetime="{createdAt}">` markup where available.

## 7. My Tickets Screen

### 7.1 Page structure and query controls

The page title is **My Tickets** and the visible requester name appears beneath it. A **Create ticket** action is available near the title.

The query toolbar contains:

| Control | Contract |
|---|---|
| Search | Label **Search tickets**; trimmed, case-insensitive substring search over ticket number and summary; submit with Enter or **Search**; separate **Clear search** control |
| Category filter | Default **All categories**; option values are category IDs |
| Related System filter | Default **All systems**; option values are related-system IDs |
| Requested Priority filter | Default **All priorities**; values are `LOW`, `MEDIUM`, and `HIGH`, displayed as **Low**, **Medium**, and **High** |
| Status filter | Default **All statuses**; **New** is the only sprint status |
| Sort | Default **Newest first**; additionally expose **Oldest first**, **Ticket number A–Z**, **Ticket number Z–A**, **Summary A–Z**, and **Summary Z–A** |
| Page size | Label **Tickets per page**; default 10; options 10, 20, and 50 |
| Reset | **Reset filters** restores defaults and clears search |

Submitting search, changing any filter or sort, changing requester, or changing page size resets to page 1. Query state should be represented in the URL so refresh and Back/Forward retain the view. The requester ID must never be placed in the URL; it remains in the request header.

The UI maps its controls to the exact API query parameters `search`, `status`, `categoryId`, `relatedSystemId`, `requestedPriority`, `sortBy`, `sortOrder`, `page`, and `pageSize`. The default request is `sortBy=createdAt&sortOrder=desc&page=1&pageSize=10` with search and filters omitted. Valid sort fields are `createdAt`, `ticketNumber`, and `summary`; sort order is `asc` or `desc`. Category and system IDs are positive integers, Requested Priority is `LOW`, `MEDIUM`, or `HIGH`, and page size must be 10, 20, or 50.

URL validation is strict and mirrors the API domain. An unknown parameter, repeated parameter, overlong search, or unsupported/malformed filter, sort, page, or page-size value must not be silently normalized into a valid request. Show a safe **The ticket list URL contains invalid query values.** alert with **Reset filters**, and do not request the requester-owned list until the URL is repaired. Reset restores `/tickets` and the canonical defaults.

Category and Related System options have their own loading and failure states, separate from ticket-list results. While options load, disable those two selects and show **Loading filter options…**. If the metadata request fails, keep the ticket list and other query controls usable, show **We couldn't load filter options.** with **Retry**, keep the two metadata selects disabled, and never present the failure as empty option data or expose raw server details. A successful retry repopulates and enables them.

### 7.2 Desktop and tablet results table

The semantic table has the accessible caption **Tickets owned by {requesterName}** and these columns:

1. Ticket number (link to detail)
2. Summary
3. Category
4. Related System
5. Requested Priority
6. Status
7. Created
8. Action (**View details** with accessible name including the ticket number)

Column headings associated with sortable fields expose the current sort direction. On tablet, wrap the table in a focusable region labelled **Ticket results — scroll horizontally for more columns**.

### 7.3 Mobile results cards

At widths below 768 px, render the same result data as cards rather than squeezing or horizontally scrolling the table. Each card contains:

- linked ticket number;
- summary as the card heading;
- labelled Category and Related System values;
- labelled Requested Priority value using visible **Low**, **Medium**, or **High** text;
- a text **New** badge;
- created date/time; and
- a full-width **View details** action.

Card order must match the active sort and pagination exactly. Table and cards are alternate presentations of one result set, not duplicate content in the accessibility tree.

### 7.4 Result and pagination states

- During a fetch, hide old requester-owned rows/cards and show a results loading state.
- **Empty** and **No results** are distinct states determined by the current query. When the default unfiltered query returns `totalItems: 0`, show **No tickets yet** plus **Create your first ticket**. When any search or filter is active and that query returns `totalItems: 0`, show **No tickets match your search or filters** plus **Reset filters**.
- Above the results, show a summary such as **Showing 11–20 of 37 tickets**.
- Pagination contains **Previous**, numbered page controls, and **Next**. The current page uses `aria-current="page"`; boundary controls are disabled.
- If a requested page becomes empty after a query change, request the nearest valid page, normally page 1.
- A list failure shows **We couldn't load your tickets.** and a **Retry** action without exposing cached data from another requester.

## 8. Ticket Detail Screen

### 8.1 Ownership and error states

Ticket detail is requested using the selected requester's header before any ticket content is rendered.

- On malformed route/request context or another documented `400`, show a safe request error and no ticket metadata.
- On `403`, render no ticket metadata or filenames. Show **You don't have permission to view this ticket.** with a **Back to My Tickets** action.
- On `404`, show **Ticket not found.** with a **Back to My Tickets** action.
- On `500` or a network failure, render no stale detail, show **We couldn't load this ticket.**, and provide **Retry**.
- These states may share layout but must preserve the API contract's status-specific user message. A `403` necessarily communicates that the selected requester cannot access an existing ticket, while a `404` communicates that the route resource is missing; neither state may render protected ticket fields, attachment metadata, filenames, or owner identity.
- Switching requester immediately leaves the detail screen as described in Section 2.2.

### 8.2 Owned ticket content

The detail screen includes:

1. **Back to My Tickets** breadcrumb/link.
2. Ticket number as the page title.
3. Visible **New** status badge.
4. Summary and full description.
5. Read-only metadata: requester, category, related system, Requested Priority displayed as **Low**, **Medium**, or **High**, created/Ticket Date, and last-updated date/time when supplied.
6. Attachment management section.

`GET /api/tickets/:id` is the UI's retrieval capability for attachment metadata. Its owned Ticket Detail response supplies both active and soft-removed attachment metadata for rendering this screen; download and soft-remove routes are separate capabilities and must not be used as metadata lookup substitutes. Loading detail therefore loads attachment metadata without downloading file bytes.

Description whitespace and line breaks are preserved safely as text; user-entered content must not be interpreted as HTML. Immutable values use read-only shaded presentation rather than disabled input controls.

On desktop, long-form description is the main column and metadata/attachments may occupy a secondary column. On tablet, compact metadata may use two columns. On mobile, content order is ticket number/status, summary, metadata, description, then attachments.

### 8.3 Attachment upload

The attachment panel shows **Attachments ({activeCount}/5)** and a visible rule summary:

**JPG, PNG, WEBP, or PDF; maximum 5 MB each; up to 5 active attachments.**

Project interpretation note: the labsheet labels the limit as **5 MB** but does not define its byte value. This project consistently interprets that limit as **5 MiB (5,242,880 bytes)** for validation and testing while keeping the user-facing label **5 MB**.

Upload behavior:

- Provide a native file chooser labelled **Choose attachment** and an **Upload attachment** button. Drag-and-drop may supplement, but must not replace, the keyboard-accessible chooser.
- Accepted extensions/MIME pairs are `.jpg`/`.jpeg` with `image/jpeg`, `.png` with `image/png`, `.webp` with `image/webp`, and `.pdf` with `application/pdf`.
- Maximum user-facing size is **5 MB** per file, using the project interpretation above.
- No more than **5 active attachments** may exist for a ticket.
- Client validation occurs before upload, but server validation remains authoritative.
- Invalid files stay unsubmitted and receive a message immediately below the chooser:
  - **Choose a JPG, PNG, WEBP, or PDF file.**
  - **File must be 5 MB or smaller.**
  - **This ticket already has 5 active attachments. Remove one before uploading another.**
- While uploading, disable the chooser and button, show filename plus **Uploading…**, and prevent duplicate submission.
- On success, announce **{filename} uploaded**, clear the chooser, and add the returned attachment metadata to the active list while incrementing the active count. An implementation may instead refresh Ticket Detail after success, but a refresh is not required.
- On `400`, associate a documented file validation/limit problem with the chooser. On `403` or `404`, reveal no foreign ticket data and leave the protected detail screen as appropriate.
- On `500`, timeout, or network failure, preserve the selected filename where the browser permits, show a safe error, and offer an explicit **Retry**.

The upload controls are disabled when the active count is 5, but the rule and existing attachment list remain readable.

### 8.4 Active attachment list and download

Each active attachment row/card shows:

- original filename;
- file type;
- human-readable size;
- upload date/time;
- **Download** action with an accessible name containing the filename; and
- **Remove** action with an accessible name containing the filename.

Filenames must wrap or truncate visually with the full value available to assistive technology; they must never overflow the layout. A download action requests the owned active attachment using the requester header. While the download begins, expose a busy state without disabling unrelated rows. If the API returns `404` because the attachment was removed or no longer exists, refresh the attachment list and show **This attachment is no longer available for download.** A `403` must reveal no filename or file bytes; a `500` or network failure shows a safe retryable download error without changing attachment metadata.

### 8.5 Soft-removal dialog and removed attachments

Activating **Remove** opens a confirmation dialog titled **Remove attachment?**. It names the file, explains that the file will no longer be downloadable, and contains:

- required **Removal reason** textarea;
- `current / 500` counter;
- **Cancel** action; and
- destructive **Remove attachment** action.

The removal reason is trimmed and must be 5–500 Unicode characters. The field message is **Removal reason must be 5 to 500 characters.** The destructive action stays disabled until the value is valid and is busy/disabled while the request runs.

After a successful soft-removal:

- close the dialog and return focus to the attachment section heading;
- announce **{filename} was removed**;
- decrement the active count and update the returned record locally, or optionally refresh Ticket Detail after success;
- move the removed record to a collapsed **Removed attachments** subsection; and
- remove all download and repeated remove controls for that record.

A removed record retains and displays the original filename, MIME/type, size, original upload timestamp, removed timestamp, and removal reason. It is visibly labelled **Removed**. No link, URL, or control may permit its file content to be downloaded.

If removal validation returns `400`, keep the dialog open, retain the reason, and associate the error with the field. On `403` or `404`, disclose no foreign metadata and close or replace stale controls as appropriate. On `500`, timeout, or network failure, keep the safe reason while mounted, show a safe error inside the dialog, and offer **Retry**.

## 9. Accessibility Requirements

Lab 2 acceptance covers the explicit core accessibility requirements below. A full WCAG 2.1 Level AA conformance audit, including additional resize/reflow modes beyond the three documented acceptance viewports, is outside this sprint.

- Use semantic landmarks: header, navigation, main, forms, sections, and footer where present. Include a **Skip to main content** link.
- Every control has a programmatic name. Visible labels are preferred; placeholders are hints only.
- Development Requester Selection is a semantic form: the dropdown has a persistent visible label, **Continue** is reachable in logical order, loading/error changes are announced, and focus moves to the error or Retry action after a failed load.
- Keyboard focus follows visual order and is never trapped except intentionally within an open modal.
- All functionality is operable by keyboard, including requester selection/change, navigation, filters, pagination, upload, download, dialog confirmation, and dismissal.
- Screen changes, success messages, and asynchronous errors use a polite live region; validation summaries and blocking request failures use an assertive alert only when immediate attention is required.
- Status, Requested Priority, warning, selection, validation, and removal are communicated with text or an understandable icon in addition to color.
- Icons that repeat adjacent text are decorative; icon-only buttons need a specific accessible name.
- Tables use a caption, column headers, and correct header associations. Mobile cards use headings and labelled definition-style metadata.
- Dates use a consistent readable display and a machine-readable `datetime` value where semantic time markup is used.
- Dialogs have an accessible name and description, trap focus while open, close with Escape/Cancel, and restore focus.
- File rules and validation messages are associated with the file input. Drag-over visuals are not the only upload instruction.

Automated UI tests should query by role, accessible name, label, and visible text. Add test IDs only where no stable semantic locator exists.

## 10. Visual and Responsive Verification Checklist

### 10.1 Global checklist

- [ ] All required Zen Green tokens match their exact hex values.
- [ ] Warning states use `--color-warning: #8A5500` and `--color-warning-bg: #FFF4D6` with text/icon meaning in addition to color.
- [ ] Page background is `#F5F7F6`; primary surfaces are distinct and readable.
- [ ] Development Requester Selection shows the demo-context notice; the application shell shows the committed requester read-only with **Change Requester**.
- [ ] Header navigation clearly indicates the active screen without color-only communication.
- [ ] Required asterisks and the **`* Required`** legend are present.
- [ ] Read-only fields use `#F0F4F1`.
- [ ] Invalid fields show a message immediately below the associated input.
- [ ] Busy submit/mutation buttons are disabled, labelled, and do not change width noticeably.
- [ ] Keyboard focus indicators are visible on every interactive control.
- [ ] No content clips or creates page-level horizontal scrolling at the documented desktop, tablet, or mobile target.
- [ ] Mobile interactive targets are at least 44 × 44 px.

### 10.2 Development Requester Selection checklist

- [ ] The selection screen gates every requester-facing screen and no protected content flashes before context validation.
- [ ] The labelled dropdown, **Continue**, loading, ready, empty, error, and **Retry** states are distinct and accessible.
- [ ] **Continue** stays disabled until an active requester is selected and selection alone does not commit context.
- [ ] Only the positive integer requester ID is stored in browser-tab `sessionStorage`; malformed, unknown, or inactive stored IDs are cleared before protected requests run.
- [ ] **Change Requester** clears requester-specific state and cancels/disregards stale responses before returning to selection.
- [ ] The selection screen and shell requester controls remain usable at the documented desktop, tablet, and mobile targets.

### 10.3 Create Ticket checklist

- [ ] Desktop uses a multi-column field grid with full-width Summary and Description.
- [ ] Tablet uses two columns for Category and Related System.
- [ ] Mobile stacks all fields and renders full-width actions.
- [ ] Ticket Number and Ticket Date show read-only pre-create placeholders and only server-returned `ticketNumber`/`createdAt` after success.
- [ ] Requester is shown as read-only context; Requested Priority is a required `LOW`/`MEDIUM`/`HIGH` selection.
- [ ] Summary and Description counters and exact limits are visible.
- [ ] Attachment-after-creation guidance is visible.
- [ ] Pending activation is disabled and a lost ticket-create response is retried with the same logical `clientRequestId`.
- [ ] First-create and replay success expose the same server-generated ticket number, Ticket Date, and **New** status without implying two tickets.
- [ ] Validation, idempotency-conflict, safe `500`/network failure, and recoverable retry states retain only appropriate safe state.

### 10.4 My Tickets checklist

- [ ] Desktop renders the complete semantic table and query controls without clipping.
- [ ] Tablet confines horizontal table scrolling to a labelled region.
- [ ] Mobile replaces the table with complete, ordered ticket cards.
- [ ] Search, category/system/Requested Priority/status filters, sort, page size, reset, result count, and pagination are present.
- [ ] Requested Priority visible text appears in both the desktop table and mobile cards.
- [ ] Loading, Empty, No results, API-error, and populated states are visually distinct using the current query's filters and `totalItems`, without an extra classification request.
- [ ] Long summaries and ticket numbers do not break layout.

### 10.5 Ticket Detail checklist

- [ ] Ticket number, Ticket Date, **New** status, Requested Priority, summary, metadata, and description have clear hierarchy.
- [ ] Desktop, tablet, and mobile content orders match Section 8.
- [ ] `GET /api/tickets/:id` supplies active and removed attachment metadata without downloading bytes.
- [ ] Active count and attachment constraints are visible.
- [ ] Upload, download, removal dialog, removed metadata, and error states are represented.
- [ ] Removed attachments expose metadata and reason but no download control.
- [ ] A `403` state reveals no foreign ticket fields or filenames.
- [ ] Long filenames and descriptions wrap without overflow.

## 11. Screenshot Evidence Paths

Capture evidence only after the UI is implemented and seeded with deterministic, non-sensitive sample data. Use a full browser viewport, 100% zoom, and no developer tools in-frame. The agreed reference viewport widths are desktop 1440 px, tablet 834 px, and mobile 390 px.

| Screen | Desktop | Tablet | Mobile |
|---|---|---|---|
| Development Requester Selection | `docs/lab-02/evidence/requester-selection-desktop.png` | `docs/lab-02/evidence/requester-selection-tablet.png` | `docs/lab-02/evidence/requester-selection-mobile.png` |
| Create Ticket | `docs/lab-02/evidence/create-ticket-desktop.png` | `docs/lab-02/evidence/create-ticket-tablet.png` | `docs/lab-02/evidence/create-ticket-mobile.png` |
| My Tickets | `docs/lab-02/evidence/my-tickets-desktop.png` | `docs/lab-02/evidence/my-tickets-tablet.png` | `docs/lab-02/evidence/my-tickets-mobile.png` |
| Ticket Detail | `docs/lab-02/evidence/ticket-detail-desktop.png` | `docs/lab-02/evidence/ticket-detail-tablet.png` | `docs/lab-02/evidence/ticket-detail-mobile.png` |

For baseline screenshots, use:

- Development Requester Selection in its ready state with deterministic active requester choices and no committed context;
- a valid requester selected;
- Create Ticket in its clean editable state;
- My Tickets with enough records to show pagination;
- Ticket Detail with at least one active and one removed attachment.

Requester loading/empty/error, validation, Empty/No results, `403`, warning-token, conflict, safe `500`, and busy-state screenshots may be added to the same evidence directory with descriptive suffixes, but they do not replace the twelve required responsive captures above.
