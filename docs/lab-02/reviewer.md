# Lab 2 — Peer Review Record

**Author:** พลัฏฐ์ อมาตย์ชยาภา - 67070507212 - GitHub: [@L0u1sss](https://github.com/L0u1sss)
**Peer reviewer:** แทนบุญ เตียวสวัสดิ์ - 67070507211 - GitHub: [@Tanaboonnnnn](https://github.com/Tanaboonnnnn)
**Peer reviewer:** ฌาธนัชย์ อุทัยพิบูลย์ - 67070507210 - GitHub: [@Chxtamos](https://github.com/Chxtamos)
**Peer reviewer:** ธนนันท์ ครังตุ้ย - 67070507211 - GitHub: [@thananun-7203](https://github.com/thananun-7203)

## Pull Requests I authored (partner review status)
| PR | Branch | Reviewer verdict |
|----|--------|------------------|
| [L0u1sss/TokTickIT#20](https://github.com/L0u1sss/TokTickIT/pull/20) | `docs/lab-02-spec-and-tests` | Changes requested, revised, approved, and merged on 2026-08-24 |
| [L0u1sss/TokTickIT#21](https://github.com/L0u1sss/TokTickIT/pull/21) | `feat/db-schema-and-seeds` | Implementation and corrected PR description accepted; merged on 2026-08-27 |
| [L0u1sss/TokTickIT#22](https://github.com/L0u1sss/TokTickIT/pull/22) | `feat/requester-selection-context` | Requester flow and isolated PostgreSQL CI evidence accepted; merged on 2026-08-28 |
| [L0u1sss/TokTickIT#23](https://github.com/L0u1sss/TokTickIT/pull/23) | `feat/create-ticket` | Create Ticket contract/accessibility and evidence follow-up accepted; merged on 2026-08-29 |
| [L0u1sss/TokTickIT#24](https://github.com/L0u1sss/TokTickIT/pull/24) | `feat/my-tickets-list` | Core implementation and review follow-up for URL validation, filter-metadata recovery, and evidence accepted; merged on 2026-08-30 |
| [L0u1sss/TokTickIT#25](https://github.com/L0u1sss/TokTickIT/pull/25) | `feat/ticket-detail-and-attachments` | Ticket Detail/Attachment lifecycle, README setup, and synchronized evidence accepted after changes; merged on 2026-08-30 |
| [L0u1sss/TokTickIT#26](https://github.com/L0u1sss/TokTickIT/pull/26) | `test/responsive-and-ui-checks` | Responsive/visual evidence and final-SHA documentation accepted; merged on 2026-08-31 |
| [L0u1sss/TokTickIT#27](https://github.com/L0u1sss/TokTickIT/pull/27) | `chore/e2e-and-release-prep` | Final Lab 2 audit, live E2E, CI integration, and release preparation reviewed and merged on 2026-08-31 |

The notes below preserve the review history that led to the approved Lab 2 contract. PRs #20–#27 were reviewed by the named peer reviewer above; requested changes were resolved in follow-up commits before merge. PR #27 is the final Lab 2 audit/release-preparation PR.

The corrected PR description must state that Requested Priority accepts exactly `LOW`, `MEDIUM`, and `HIGH`, and that Ticket Status is constrained to `NEW` for Lab 2. It must not claim support for `CRITICAL`, `OPEN`, `IN_PROGRESS`, `RESOLVED`, or `CLOSED`. It should also identify `20260825000000_align_lab02_contract` as the corrective migration that safely narrows the original enum definitions while preserving supported existing data and failing explicitly when incompatible rows exist.


How I responded:

- Added required `requestedPriority` values `LOW`, `MEDIUM`, and `HIGH` across the functional requirements, data model, create/list/detail API representations, UI, Acceptance Criteria, and tests.
- Replaced the header-first selector flow with a dedicated Development Requester Selection screen, Continue gating, loading/empty/error/Retry states, validated browser-tab persistence, app-shell context, Change Requester, deep-link gating, and stale-state protection.
- Declared `GET /api/tickets/:id` as the Retrieve Attachment Metadata capability instead of adding a redundant endpoint.
- Added Acceptance Criteria and automated traceability for requester switching, empty versus no-results, failure recovery, responsive behavior, accessibility, idempotency, priority, and safe unexpected failures.
- Added UUID `clientRequestId` first-create/replay/conflict/concurrency behavior so a lost response and retry cannot create a duplicate ticket.
- Standardized the assignment wording as 5 MB with the exact `5,242,880`-byte boundary, defined safe `500 INTERNAL_ERROR`, added Zen Green warning tokens, and specified read-only Ticket Number/Ticket Date placeholders and server values.
- Corrected related cross-document inconsistencies in nested-attachment status handling, trace-matrix membership, filename/storage wording, and reviewer evidence.

Follow-up reviewer comment:

The reviewer confirmed that the previously missing Lab 2 requirements were now covered, then asked for two final scope clarifications. First, `5,242,880` bytes is technically 5 MiB, so the documents must identify it as the team's interpretation of the labsheet's undefined “5 MB” label rather than imply that the labsheet supplied that byte count. Second, production-hardening details such as concurrency stress behavior, file-signature inspection, storage compensation, 320 px/200% zoom checks, and mid-stream download failure would become mandatory implementation work if left in the normative contract.

How I responded to the follow-up:

- Documented that the labsheet supplies the “5 MB” label but not an exact byte conversion, and that using 5 MiB (`5,242,880` bytes) is an explicit, revisable team decision.
- Kept the required `clientRequestId` first-create/replay/conflict and lost-response behavior, but deferred concurrency stress testing.
- Reduced attachment validation to the required extension/declared-MIME pairing and size/count rules; file-signature inspection, staged compensation, attachment-level idempotency, and physical-byte retention policy are outside the Lab 2 acceptance scope.
- Kept safe pre-response `500` behavior while removing a dedicated mid-stream download-failure obligation.
- Kept the three documented responsive viewports and core keyboard/label/focus/live-region accessibility checks while removing extra 320 px, 200% zoom, forced-colors, and reduced-motion acceptance gates.
- Simplified Empty versus No Results to depend on whether search/filter criteria are active instead of requiring an additional unrestricted API probe.

Status: PRs #20–#27 are merged into `lab2-staging`. PR #27 is the final audit/release-preparation change; any later `lab2-staging` to `main` merge is a release operation, not additional Lab 2 feature scope.

CI follow-up on 2026-08-29:

- Review-follow-up SHA `3ba340025fe8f6b8ca4c4624ac02c2c0f39ba3a8` failed [GitHub Actions job 99131165844](https://github.com/L0u1sss/TokTickIT/actions/runs/33264182574/job/99131165844) in the client suite. Server tests had already passed; lint and builds were skipped after the client failure.
- The failing My Tickets test checked the `getTickets` spy immediately even though the component queues the request in a microtask. On the hosted Linux runner the loading state rendered before the spy call, producing `Number of calls: 0`.
- The test now uses `waitFor` for that asynchronous call. This changes test synchronization only, not production code.
- Local verification after the fix passed My Tickets 17/17 five consecutive times, full client 66/66, full server 103/103, both lint/build commands, and Prisma validation. A new commit and hosted CI rerun remain required.

## PR #24 review follow-up

Reviewer feedback:

- Recheck whether `sortBy`, `sortOrder`, and the default ordering match the approved contract.
- Do not silently replace invalid client URL-query values with defaults when the backend contract rejects them as `400 INVALID_QUERY`.
- Distinguish a failed Category/Related System metadata request from a valid empty option set, and provide visible recovery.

How I responded:

- Verified the source of truth before changing behavior. The implementation, `api-spec.md`, `ui-spec.md`, and the specification decision record already agree on `sortBy=createdAt`, `sortOrder=desc`, displayed as **Newest first**, with `createdAt`, `ticketNumber`, and `summary` as the only sort fields. The documents now state that canonical default more explicitly; no sort behavior or API domain was changed.
- Added strict client URL validation for the exact nine documented query parameters. Unknown or repeated parameters, overlong Unicode search, malformed/unsupported filters or sort values, non-positive pages, and unsupported page sizes now show **The ticket list URL contains invalid query values.** with **Reset filters**. No requester-owned list request is sent until the URL is repaired.
- Added independent filter-metadata states. Category and Related System selects are disabled while their options load; metadata failure shows **We couldn't load filter options.** with **Retry**, keeps valid ticket results and unrelated controls usable, and never exposes raw server/Prisma details or misrepresents failure as an empty dataset.
- Added warning-token styling and a mobile stack for the new metadata state.
- Added six invalid-query component cases plus one metadata failure/Retry case. The My Tickets component suite increased from 10/10 to 17/17, and the full client suite increased from 59/59 to 66/66.
- Updated `specification.md`, `api-spec.md`, `ui-spec.md`, `tests.md`, and `ai-use.md` so the contract, traceability, local results, hosted baseline, and deferred evidence match the implementation.

Verification performed on the local review-follow-up tree based on `36857e27d631e19777c94662c681bfb5d5dfa543`:

- My Tickets component tests: 17/17 passed.
- Full client tests: 66/66 passed across 8 files.
- Full server tests: 103/103 passed across 14 files.
- Client and server TypeScript builds passed.
- Client and server ESLint passed with zero warnings.
- Prisma schema validation passed.
- `git diff --check` passed with no whitespace errors.
- The prior PR head `36857e27d631e19777c94662c681bfb5d5dfa543` passed [GitHub Actions run 33261715434](https://github.com/L0u1sss/TokTickIT/actions/runs/33261715434); the new review-follow-up SHA must run hosted CI after commit/push.

## Pull Requests I reviewed for my partner


| Repository / PR | Review focus | Evidence recorded |
|---|---|---|
| [Tanaboonnnnn/toktickit#16](https://github.com/Tanaboonnnnn/toktickit/pull/16) | ตรวจความครบถ้วนของ Lab 2 documentation/specification และ feedback ต่อ requirement ที่ยังขาด | Local review request และ branch `remotes/tanaboon/pr/16` |
| [Tanaboonnnnn/toktickit#21](https://github.com/Tanaboonnnnn/toktickit/pull/21) | ตรวจ database schema, migration, seed และความสอดคล้องกับ Lab 2 contract | Local review request และ branch `remotes/tanaboon/pr/21` |
| [Tanaboonnnnn/toktickit#25](https://github.com/Tanaboonnnnn/toktickit/pull/25) | ตรวจ Ticket Detail/Attachment lifecycle, README, responsive evidence และ test evidence | Review feedback ที่บันทึกในงานสนทนา; GitHub merge status ไม่สรุปซ้ำในเอกสารนี้ |
| [Tanaboonnnnn/toktickit#27](https://github.com/Tanaboonnnnn/toktickit/pull/27) | ตรวจ final Lab 2 audit, E2E, CI และ release preparation | Review feedback ที่บันทึกในงานสนทนา; GitHub merge status ไม่สรุปซ้ำในเอกสารนี้ |
| [Chxtamos/-TokTickIT-#23](https://github.com/Chxtamos/-TokTickIT-/pull/23) | ตรวจ Ticket Detail/Attachment implementation เทียบกับเอกสารอ้างอิง | Review request ที่บันทึกในงานสนทนา |
