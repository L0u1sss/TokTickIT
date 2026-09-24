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

### Prompts 3–10

Pending. Add only prompts actually used for specification review, migration, implementation, tests, accessibility, hardening, or release. For each, record date, purpose, what was accepted/modified/rejected, and how it was verified.

## Decisions Made While Reviewing AI Output

- Accepted a separate Action assignee and authenticated performer because the rubric requires assignment while the stakeholder text requires automatic performer identity.
- Modified the vague append-only requirement into immutable Action events plus an editable current projection, preserving both edit behavior and auditability.
- Added optimistic revision checks and idempotent creation because the handout explicitly requires stale-update and duplicate/retry handling.
- Chose one completed Action with Result as the minimum resolution gate. This is a project decision requiring peer review; it is not presented as wording fixed by the handout.
- Rejected inventing notification, SLA, Action-specific uploads, administrator analytics, or other excluded functionality.
- Kept all test status as Planned until commands actually run.

## My Reflection

The specification-agent role is most useful for finding hidden choices across the handout, rubric, and previous contracts. Its main risk is turning a plausible interpretation into an apparent requirement. I reduced that risk by labeling project decisions, preserving explicit exclusions, and making every rule observable through an Acceptance Criterion.

The coding-agent role should implement one reviewed issue at a time and use the contract as a constraint. Generated code still needs database migration testing, authorization tests, concurrency tests, browser checks, and peer review. Passing output and attractive UI alone are insufficient when ownership, audit history, or stale updates can be wrong.

## Known Limitations of This Log

Only two prompts have been used and recorded at contract creation time. Final submission requires 6–10 selected real prompts and a revised reflection grounded in implementation and review outcomes.
