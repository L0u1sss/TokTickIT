# TokTickIT Lab 4 — AI Use and Reflection Log

> This log distinguishes actual prompts from planned placeholders. It must be updated during Sprint 4 and must not claim unperformed validation or approval.

## Tools and Responsibility

LLM used: OpenAI Codex. The student remains responsible for checking the labsheet, resolving product decisions, reviewing diffs, running tests, obtaining peer review, and accepting or rejecting suggestions. AI output is not test or approval evidence.

## Selected Key Prompts

### Prompt 1 — Issue decomposition (used, 2026-09-24)

“ช่วยเขียน issue จากเอกสารนี้หน่อย โดยอิงจาก issue ก่อนๆ ใน TokTickIT” with `SE+Lab+4.pdf` attached.

**Use:** Produced a Lab 4 issue decomposition based on the handout and earlier repository issue style. The result was reviewed against the source before Issue #52 was used.

### Prompt 2 — Start the engineering contract (used, 2026-09-25)

“เริ่มทำ https://github.com/L0u1sss/TokTickIT/issues/52 เลย”

**Use:** Triggered repository inspection and drafting of the six Sprint 4 contract files. Decisions were checked against Lab 3 schema/API/UI contracts rather than copied blindly.

### Prompt 3 — Implement Actions Taken API (used, 2026-09-26)

“ดำเนินการทำ Issue #54 อิงจากเอกสาร Lab 4”

**Use:** Implemented list/retrieve/create/update/lifecycle APIs, requester ownership, staff authorization, actor protection, assignee eligibility, audit events, optimistic concurrency, idempotent retry, safe failures, and API tests. The result was checked with targeted and full isolated PostgreSQL suites.

### Prompt 4 — Implement Actions Taken UI (used, 2026-09-26)

“ทำ Issue #55 อิงจากเอกสาร Lab 4”

**Use:** Implemented the shared Actions Taken section in staff and Requester Ticket Detail, including create/edit/assign/lifecycle controls, read-only visibility, validation, idempotent submission behavior, stale-conflict draft retention, safe failures, responsive Zen Green styling, and component tests. The result was checked with client build, lint, the focused Lab 4 suite, and all client tests.

### Prompt 5 — Align Issue #55 with the merged contract (used, 2026-10-02)

“ทำงานตาม PR นี้ [https://github.com/L0u1sss/TokTickIT/issues/55#issue-5571643072](https://github.com/L0u1sss/TokTickIT/issues/55#issue-5571643072) โดยอิงจากเอกสาร D:\Software_Engineering\SE+Lab+4.pdf”

**Use:** Read all 11 pages of the handout and mapped §§7, 8.3, 8.5–8.6, 12 and Answer Part 6 to the existing engineering contract. Reviewed the earlier Actions UI against the incoming API and identified missing parent-version tokens, non-null performer assumptions, and obsolete terminal-reopen behavior. Updated the shared UI and staff integration to consume the actual response envelope, preserve drafts/request identity during recovery, share the latest Ticket version, prevent overlapping aggregate writes, enforce the documented lifecycle in available controls, and display automatic recorder/completion/cancellation provenance. Added component/integration coverage and a real-API browser flow with three viewports and screenshot/axe evidence. Review feedback also corrected field-error clearing and focus recovery after terminal transitions.

**Verification:** The final local client suite passed 19 files/141 tests, including 20 Action component tests and 25 Staff Detail/Queue tests. Client lint and build passed. The isolated real-API flow passed 7 tests and generated 25 screenshots; it includes actual inactive-assignee rejection/recovery, role/ownership restrictions, a real stale update with draft reapplication, and a committed create followed by a lost response and same-ID replay. [tests.md](./tests.md#10-issue-55-contract-alignment-and-local-evidence--2026-10-02) links the output and screenshot evidence. CI wiring is implemented, but hosted CI, peer approval, final `main`, and complete manual keyboard/200% reflow checks are not claimed.

### Prompt 6 — Implement Ticket workflow (used, 2026-09-26)

“ทำ Issue #56 โดยอิงจากเอกสาร Lab 4”

**Use:** The original PR #66 implemented the eight-state matrix, minimum completed-Action gate, timestamp conflict checks, workflow feedback, advisory-only Requester behavior, and API/component/browser tests. This historical implementation preceded the newer integer-version and workflow-cycle contract; its earlier results do not establish compatibility with the current staging branch.

### Prompt 7 — Update PR #66 against Lab 4 (used, 2026-10-03)

The user linked https://github.com/L0u1sss/TokTickIT/pull/66 and requested changes based on `D:\Software_Engineering\SE+Lab+4.pdf`, preserving existing code and selecting incoming changes on conflict. The user clarified: “ขอโทษฉันหมายถึงให้ทำงานบน branch feat/lab4-ticket-workflow แล้วยกเลิกงานที่ทำบน lab4-staging อยู่”.

**Use:** Read the handout and current contract, preserved backup refs and conflict snapshots, integrated incoming staging dependencies into the feature branch, and aligned status writes with the shared integer Ticket version and parent-before-child locking. Resolution now checks current-cycle completed work, active Actions, and outstanding non-cancelled follow-up; cancellation/reopen provenance and previous history remain intact. Updated workflow UI, regression fixtures, CI, and live browser evidence. Validation is recorded in [tests.md](./tests.md#pr66-validation). Work on `lab4-staging` was cancelled; no feature changes were published there.

### Prompt 8 - Align PR #67 and fix CI (used, 2026-10-03)

The user linked [PR #67](https://github.com/L0u1sss/TokTickIT/pull/67) and requested fixing CI and completing the PR on the selected branch, using `D:\Software_Engineering\SE+Lab+4.pdf`.

**Use:** Read the handout, current engineering contract and failing CI logs; integrated the already merged PR #66 on `feat/lab4-requester-dashboard`; preserved requester functionality while resolving dependency conflicts. Corrected the backend seven-day resolvedAt calculation and UTC bounds, implemented exact My Tickets drill-down and validation, restored Actions browser script/fixtures, and updated browser regression for Dashboard home. Added ownership/date-boundary/legacy/tie/drill-down/aggregate-recency tests, real browser/axe/screenshots, and direct database count evidence. Validation is in [tests.md](./tests.md#12-pr-67-requester-dashboard-contract-and-ci-alignment---2026-10-03).

### Prompts 9-10

Pending. Add only prompts actually used for later hardening or release work.

## Decisions Made While Reviewing AI Output

- Accepted a separate Action assignee and authenticated performer because the rubric requires assignment while the stakeholder text requires automatic performer identity.
- Modified the vague append-only requirement into immutable Action events plus an editable current projection, preserving both edit behavior and auditability.
- Added optimistic revision checks and idempotent creation because the handout explicitly requires stale-update and duplicate/retry handling.
- Updated the old UI to the merged API's required parent Ticket version and `{ action, ticketVersion }` envelope. Mocked old response shapes were insufficient to prove live compatibility, so the follow-up adds authenticated browser/API evidence rather than relying on the earlier UI pass claim.
- Applied the approved immutable terminal lifecycle and current-assignee completion rule. The performer is absent before completion, and cancelled follow-up is historical data; these are explicit project decisions in the contract rather than wording prescribed by the handout.
- Replaced the earlier minimum-only gate with the current approved BR-21 predicate: completed work with Result in the current cycle, no active Actions, and no outstanding follow-up on non-cancelled Actions. These are project decisions, not wording fixed by the handout.
- Rejected inventing notification, SLA, Action-specific uploads, administrator analytics, or other excluded functionality.
- Kept all test status as Planned until commands actually run.

## My Reflection

The specification-agent role is most useful for finding hidden choices across the handout, rubric, and previous contracts. Its main risk is turning a plausible interpretation into an apparent requirement. I reduced that risk by labeling project decisions, preserving explicit exclusions, and making every rule observable through an Acceptance Criterion.

The coding-agent role should implement one reviewed issue at a time and use the contract as a constraint. Generated code still needs database migration testing, authorization tests, concurrency tests, browser checks, and peer review. Passing output and attractive UI alone are insufficient when ownership, audit history, or stale updates can be wrong.

## Issue #55 Review Observation

The coding-agent review found that the earlier UI tests could pass while the implementation omitted the merged backend's required concurrency token or dereferenced a performer that is legitimately null. The follow-up checks both sides of the contract and adds authenticated workflows. Automated axe and overflow checks do not establish completion of the final visual, keyboard, or 200% reflow review. This is an observation from the implementation review, not a substitute for the student's final personal reflection.

## Known Limitations of This Log

Eight prompts have been used and recorded. Final submission still requires final validation against the submitted commit and a student-written revised reflection grounded in later implementation and review outcomes. Do not invent prompts to fill the quota or present worktree evidence as final `main`/peer approval.
