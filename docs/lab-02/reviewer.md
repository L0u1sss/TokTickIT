# Lab 2 — Peer Review Record

**Author:** พลัฏฐ์ อมาตย์ชยาภา — 67070507212 — GitHub: @L0u1sss
**Peer reviewer:** Tanaboon — GitHub: [@Tanaboonnnnn](https://github.com/Tanaboonnnnn)

## Pull Requests I authored (reviewed by my partner)
| PR | Branch | Reviewer verdict |
|----|--------|------------------|
| [L0u1sss/TokTickIT#20](https://github.com/L0u1sss/TokTickIT/pull/20) | `docs/lab-02-spec-and-tests` | Changes requested on reviewed commit `ebf4182` |

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

Status: documentation changes are prepared for a follow-up commit; reviewer re-review and approval are still pending.

## Pull Requests I reviewed for my partner

My comment: Not recorded as part of PR #20.

Partner's response: Not recorded as part of PR #20.
