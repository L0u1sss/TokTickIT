# Lab 2 — Peer Review Record

**Author:** พลัฏฐ์ อมาตย์ชยาภา - 67070507212 - GitHub: [@L0u1sss](https://github.com/L0u1sss)
**Peer reviewer:** แทนบุญ เตียวสวัสดิ์ - 67070507211 - GitHub: [@Tanaboonnnnn](https://github.com/Tanaboonnnnn)

## Pull Requests I authored (partner review status)
| PR | Branch | Reviewer verdict |
|----|--------|------------------|
| [L0u1sss/TokTickIT#20](https://github.com/L0u1sss/TokTickIT/pull/20) | `docs/lab-02-spec-and-tests` | Changes requested on `ebf4182`; revised documentation later merged as `a4065f9` |
| [L0u1sss/TokTickIT#21](https://github.com/L0u1sss/TokTickIT/pull/21) | `feat/db-schema-and-seeds` | Peer review pending; local corrective changes are not pushed yet |

As of 2026-08-25, PR #21 still points to remote head `3a6291d`; the corrective schema/migration/test changes and `DB-01` evidence recorded in this branch must be committed and pushed before the peer can review them on GitHub.

Before requesting PR #21 re-review, update its description as well: remove the stale `CRITICAL` and post-`NEW` status claims, replace old `currentStatus`/attachment field wording with the canonical Section 7 names, list corrective migration `20260825000000_align_lab02_contract`, classify `DB-01` as Database / Integration rather than Unit, replace placeholder `AC-XX` rows with the three Issue #13 deliverables, and attach the final 11/11 plus regression/build evidence from the pushed commit.

Reviewer comment I received:

The reviewer found the ownership, attachment, API-error, responsive-UI, and core test planning detailed, but requested changes before merge because the contract omitted or did not trace several Lab 2 requirements. Blocking topics were Requested Priority, the dedicated Development Requester Selection flow, explicit attachment-metadata capability wording, requester/state/responsive/accessibility Acceptance Criteria, retry-safe duplicate-submission prevention, the assignment's 5 MB terminology, safe `500` behavior, warning/amber tokens, and clear Ticket Number/Ticket Date presentation on Create Ticket. See the [full GitHub review](https://github.com/L0u1sss/TokTickIT/pull/20#pullrequestreview-5002758180).

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

Status: the PR #20 documentation revisions are merged into `lab2-staging`. The PR #21 database correction is verified locally but still requires a final commit, push, and peer re-review.

## Pull Requests I reviewed for my partner

My comment: Not recorded as part of PR #20.

Partner's response: Not recorded as part of PR #20.
