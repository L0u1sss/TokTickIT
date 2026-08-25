# Lab 2 — AI Use and Reflection

**LLM/agent used:** OpenAI Codex

**Scope:** Review and revision of the Lab 2 specification documents, followed by implementation and isolated verification of the Issue #13 database foundation. API/UI application behavior and the remaining planned tests are not claimed as implemented.

## Selected key prompts

| # | Prompt (summarised) | What I did with the result |
|---:|---|---|
| 1 | Review PR #20 and verify the peer review feedback against the actual files | Compared the reviewed commit with `specification.md`, `api-spec.md`, `ui-spec.md`, and `tests.md`; separated valid blockers from points that were already partly covered. |
| 2 | Add the missing Requested Priority requirement consistently | Added required `requestedPriority` values `LOW`, `MEDIUM`, and `HIGH` to the requirements, data model, create/list/detail API contract, UI, Acceptance Criteria, and planned tests. |
| 3 | Correct the Development Requester Selection flow | Replaced the header-first selector design with a dedicated selection screen, dropdown, gated Continue action, loading/empty/error/Retry states, validated tab-session restoration, deep-link gating, and Change Requester behavior. |
| 4 | Design retry-safe duplicate-submission prevention | Added UUID `clientRequestId` semantics for first create, exact replay, conflicting reuse, concurrency, and lost-response retry, plus database, UI, AC, and test-plan coverage. |
| 5 | Resolve API, attachment, error, and UI-token feedback | Made Ticket Detail explicitly fulfill attachment-metadata retrieval, standardized the 5 MB boundary, defined safe `500 INTERNAL_ERROR`, added warning tokens, and clarified Ticket Number/Ticket Date presentation. |
| 6 | Audit cross-document traceability and contradictions | Checked FR/BR/AC sequences, test-ID-to-AC matrix membership, JSON examples, Markdown tables/links, ownership statuses, attachment retention/timestamps, failure recovery, responsive behavior, and accessibility coverage; corrected the concrete inconsistencies found. |
| 7 | Apply the follow-up review about the 5 MB interpretation and accidental scope growth | Recorded 5 MiB (`5,242,880` bytes) as a team interpretation rather than a labsheet quote, retained required Lab 2 behavior, and removed production-hardening acceptance obligations for concurrency stress, signature inspection, compensation, extra viewport/zoom gates, and mid-stream failures. |
| 8 | Re-audit Issue #13 and PR #21 against the labsheet and final Section 7 contract, then add missing work | Replaced mismatched persistence fields/enums with the canonical contract, added a data-preserving corrective migration, attachment audit actors, missing indexes/constraints, isolated `TEST_DATABASE_URL` protection, deterministic seed updates, and an 11-case `DB-01` database integration suite; validated the full migration chain in a disposable PostgreSQL schema. |

## Reflection

The agent was most useful when the request named exact PRs and supplied reviewer feedback, because each recommendation could be checked against concrete lines instead of accepted blindly. Three corrections required judgment rather than copying a reference: retaining the PR's existing ticket-number format, separating Lab 2 requirements from optional production hardening, and preserving supported legacy database rows through a new corrective migration instead of rewriting applied migration history. The first database-test run exposed an assertion that expected a named check even though PostgreSQL rejected the oversized varchar earlier; the test was corrected to verify both the column limit and the trimming check at their actual enforcement layers. The author should review the final diff and obtain peer re-review before merge.
