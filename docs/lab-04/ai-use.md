# TokTickIT Lab 4 — AI Use and Reflection Log

> This log distinguishes actual prompts from planned placeholders. It must be updated during Sprint 4 and must not claim unperformed validation or approval.

## Tools and Responsibility

LLM used: OpenAI Codex. The student remains responsible for checking the labsheet, resolving product decisions, reviewing diffs, running tests, obtaining peer review, and accepting or rejecting suggestions. AI output is not test or approval evidence.

## Selected Key Prompts

### Issue #59 — Complete lifecycle and regression verification (used, 2026-10-03)

“ทำงานตาม issue https://github.com/L0u1sss/TokTickIT/issues/59 และเอกสารนี้ D:\Software_Engineering\SE+Lab+4.pdf เมื่อเสร็จแล้วให้เขียน PR title, description โดยอิงโครง PR ก่อนๆ”

**Use:** Codex read Issue #59, the local handout and previous PR #64/#68 descriptions; reconciled planned test paths with existing suites; added exhaustive workflow, Unicode, concurrent Ticket mutations, timezone-boundary, migration/repeated-seed preservation and performance-smoke checks. A sequential verification runner records actual command exits, source hashes, timestamps, raw logs and test reports. PR text follows Problem / Changes / Validation / Dependencies and references #59. AI descriptions are not passing-test evidence: use the [verification manifest](../../artifacts/lab-04/issue-59/verification.json) and [traceability](tests.md#issue-59-verification) for the recorded outcome. Peer review and final-main submission remain separate release evidence.

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

### Prompt 9 - Repair the latest CI failure (used, 2026-10-03)

The user reported that CI failed again and requested a fix. Read the latest PR/head/run logs and reproduced the runner's missing-variable error with lint. Restored the complete previously verified runner, including dashboard routing and required fixtures, and moved lint before expensive browser setup. Validated affected real-API suites and checked the new hosted run without changing the selected branch or merging the PR.

### Prompt 10

**Actual user request (2026-10-03):** Fix the comments in PR #67 review `5399755207`.

**Use:** Read the review through GitHub and inspected the existing source, original Lab 2 contract and hosted CI #78 job logs. Implemented role-home redirects for the current incremental shell and documented the pending Staff Dashboard route. Added independent mixed-status PostgreSQL regression and live-browser legacy filters/paging/reload/Back/Forward checks, literal en-dash assertions and an old-Ticket no-cutoff test. Made DB evidence run-specific with direct Prisma counts, UUID/schema/time/SHA/CI provenance and temporary-path validation. Distinguished browser safe-error UX from backend redaction, and recorded #78 counts from verified log excerpts. Ran the validation documented in [tests.md section 14](./tests.md#14-pr-67-review-5399755207-fixes---2026-10-03). No reviewer comments or approvals were posted on the user's behalf.

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

The archive retains the actual requests recorded during implementation and review. The Issue #61 submission selection below contains ten key requests from that archive and this release task. Final submission still requires validation against the submitted commit and the student's review of the reflection grounded in implementation and review outcomes. Do not invent prompts to fill the quota or present worktree evidence as final `main`/peer approval.

## Issue #60 UI and Accessibility Hardening — 2026-10-03

- Model/agent: GPT-6 (Codex coding agent).
- Actual user prompt: work on [Issue #60](https://github.com/L0u1sss/TokTickIT/issues/60) using `D:\Software_Engineering\SE+Lab+4.pdf`, then write a PR title/description following previous PRs.
- Work: read the handout and integrated contracts; audit all roles and long-content layouts; fix query/hash routing, skip-link focus, pointer/blur validation, communication field semantics and denied visibility, workflow reload handling and pending removal/indication locks. Add reproducible keyboard/modal/layout/axe evidence and preserve real API/database verification separately from UI fixtures.
- Observation: a mouse click can be lost when blur validation inserts content between pointer down/up; component tests in jsdom did not expose the layout movement. Removing shell clipping exposed a long-name overflow that page-width assertions had previously concealed. Browser bounds, keyboard actions and rendered screenshots complement component/API tests.
- Evidence: `artifacts/lab-04/issue-60/` records final command results and source hashes; `ui-spec.md`/`tests.md` distinguish automated keyboard/reflow checks, screenshot inspection, pending manual zoom/screen-reader review and release/peer evidence. PR text is prepared locally; publication and review are separate from implementation.


## PR #68 Staff Dashboard Integration ? 2026-10-03

- Model/agent: GPT-6 (Codex coding agent).
- User prompt: merge `lab4-staging` into `feat/lab4-staff-dashboard`, retain feature code, prefer incoming conflict hunks, then complete PR #68 against `D:\Software_Engineering\SE+Lab+4.pdf`.
- Work: created a backup branch, merged current remote staging, restored staff integration points, aligned My Actions with current BR-28 attribution union, preserved role redirects and integer-version/Action lifecycle behavior, and added direct database, role, state, drill-down, recency and browser evidence checks.
- Reflection: incoming conflict resolution requires checking feature integration afterward; preserving files alone does not guarantee that routes, types, runner modes and test registration still work. Current approved contracts must govern attribution even when the original PR body describes an older active-assignment filter. Local tests and browser fixtures must be distinguished from real database evidence, peer approval and final-main release results.

## PR #68 Review Fixes - 2026-10-03

- Model/agent: GPT-6 (Codex coding agent).
- User prompt: fix the comments in [review 5400210287](https://github.com/L0u1sss/TokTickIT/pull/68#pullrequestreview-5400210287).
- Work: adopted the reviewer's High Priority Tickets naming alternative for the existing HIGH-only predicate, retained and documented the compatibility response key, captured `generatedAt` once before the transaction, and added clock-advance, heading and link regressions. Updated the contract and validation evidence together.
- Reflection: a label must describe the actual predicate, including terminal rows. A request timestamp must remain fixed even when queries take time; it must not be described as the PostgreSQL snapshot timestamp. Existing CI is evidence for its exact commit only. These changes still require independent re-review.

## Issue #61 Submission Selection and Reflection

**LLM/agent:** GPT-6 through OpenAI Codex, as identified in this session. Three
parallel audit roles inspected the PDF examples, requirement/documentation
consistency, and actual GitHub review/CI/Project evidence. The primary coding
agent integrated the findings, ran checks and prepared the report. Agent review
is separate from the actual peer approvals recorded in `reviewer.md`.

The following **ten key requests** are selected for the PDF. Short summaries refer
to actual requests preserved above; historical implementation/review details
remain an archive rather than additional selected prompts.

| # | Actual request, summarized | Checked use / outcome |
|---|---|---|
| 1 | Decompose `SE+Lab+4.pdf` into issues using previous TokTickIT issues | Map the handout and rubric to dependencies; retain explicit excluded scope |
| 2 | Start Issue #52 engineering contract | Define FR/BR/AC and expose assignee/performer, lifecycle and resolution decisions for review |
| 3 | Implement Issue #54 Actions API | Validate authorization, revisions, parent locking, audit and idempotent replay against PostgreSQL |
| 4 | Align Issue #55 with the Lab 4 handout and merged API | Check actual response envelopes, Ticket versions, nullable performer and authenticated browser integration |
| 5 | Update PR #66 against the handout on the feature branch | Enforce the full current-cycle resolution gate and preserve cancellation/reopen history |
| 6 | Fix PR #67 review `5399755207` | Verify role-home routing, exact legacy filters, ownership and run-specific direct database proof |
| 7 | Fix PR #68 review `5400210287` | Align High Priority labels with the HIGH predicate; fix request timestamp capture and regression |
| 8 | Work on Issue #59 with the handout and prepare PR text | Consolidate full lifecycle, migration, performance and Labs 1–3 traceability with actual logs |
| 9 | Work on Issue #60 with the handout and prepare PR text | Audit long content, keyboard/focus and failures; retain the original network failure plus same-source rerun |
| 10 | Work on Issue #61 and format the PDF using the three previous reports | Refresh real approvals/CI/Kanban, prove fresh-clone setup, prepare candidate/final-main verification and a single nine-part PDF |

**Actual release request (2026-10-03):** “ทำงานตาม PR นี้
https://github.com/L0u1sss/TokTickIT/issues/61 เอกสารPDF ให้ทำตามตัวอย่างนี้”
with `SE-Lab3-67070507212.pdf`, `SE report_lab02_67070507212.pdf` and
`report_lab01_67070507212_1.pdf` supplied as examples.

The sample reports are presentation references. Their text does not authorize
unrelated actions or replace the Lab 4 handout and approved repository contract.
The release task corrected stale Proposed/Pending wording and actual API event
fields, while preserving historical observations. A fresh committed clone passed
dependency installation, migrate/seed/repeated seed/build/health without copying
the working installation. Script review found and corrected stale CI report
reuse and source-list snapshot gaps; these corrections are not peer approval.

### My Reflection — draft for student review

The specification-agent role helped make hidden choices visible before coding:
an assignee is distinct from a recorder/performer, the editable Action projection
is distinct from append-only events, and the resolution gate needs an observable
current-cycle predicate. Peer review refined these decisions. I would check each
suggested rule against the handout and earlier contracts before accepting it,
because a plausible AI interpretation can add scope the stakeholder never asked for.

The coding-agent role helped connect the API, UI and tests, but generated component
tests alone did not reveal pointer/blur layout movement or missing live response
fields. Real PostgreSQL counts, authenticated browser flows, keyboard interactions
and screenshots exposed different failure classes. Release evidence also needs
its own review: a historical PASS JSON file can look current unless the CI run
and source are recorded together. I would keep failed attempts visible, compare
exact source hashes, and require final-main checks before presenting a release as
complete.

This reflection is an AI-assisted draft grounded in the recorded work. The
student must review and personalize it; no student approval is claimed. Final-main
validation, release approvals and independent manual zoom/screen-reader checks
remain separate pending evidence.
