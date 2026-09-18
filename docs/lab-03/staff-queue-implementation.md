# Issue #32: IT Staff Ticket Queue

Implementation scope follows Lab 3 section 8.3 and the existing API/UI contracts.
Staff and Administrators may browse the queue; Requesters cannot access its API or UI.
Ticket operations (claim, reassign, status changes, comments and notes) remain issue #33.
The queue links to a read-only staff detail screen as the integration point for that work.

## Tests planned before implementation

- API: authenticated staff/admin access, unauthenticated/requester denial, safe projections.
- Query: defaults, search across ticket/requester fields, combined filters, eligible owners,
  deterministic sorting, pagination, out-of-range empty pages, malformed/duplicate/unknown query rejection.
- Migration: preserve tickets/attachments; backfill IT Priority from Requested Priority;
  new tickets copy Requested Priority and start unassigned.
- UI: loading, empty/no-results, forbidden, invalid query/reset, retry, URL navigation,
  filter page reset, detail links and safe rendering.
- Browser: desktop/tablet/mobile, keyboard controls, overflow and screenshots.

## Contract decisions

- Default ordering is `updatedAt desc, id desc`. Enum sorting uses PostgreSQL declaration
  order: priority LOW/MEDIUM/HIGH; status NEW/OPEN/IN_PROGRESS/WAITING_FOR_REQUESTER/
  RESOLVED/CLOSED/REOPENED/CANCELLED. The ID tie-breaker follows the selected direction.
- Page sizes accept every integer from 1 to 100. Page numbers are bounded at 21,474,836
  to keep the maximum SQL offset within its supported integer range. Out-of-range result
  pages return an empty list while preserving total counts. Rows/count use one repeatable-read snapshot.
- The migration backfills IT Priority from Requested Priority, adds a nullable restrictive
  owner relation, extends the status enum and replaces Lab 2's NEW-only check. The
  authenticated create service explicitly copies priority for all newly submitted tickets.
- The read-only detail endpoint exposes description and related system in addition to
  queue fields. Attachments, assignment/status mutations, comments and notes are #33 work.
- Desktop groups related values into six labelled columns; below 1024px the same data
  uses cards. Filters, badges, accessible labels, keyboard focus and 44px buttons use Zen Green.

## Validation results

Local verification on 2026-09-18; no hosted CI or peer approval is claimed.
See `tests.md` for final counts and executable commands. Tests run in disposable schemas
on the dedicated test database; the development database was not migrated by this task.

Browser evidence: `artifacts/lab-03/screenshots/staff-queue/` contains desktop (1440x900),
tablet (834x1112), mobile (390x844), plus tablet/mobile result cards. The live browser
flow exercises session login, real queue API, search, Mine, pagination, reload, detail,
browser Back, no results, invalid query/reset, keyboard focus and logout invalidation.
