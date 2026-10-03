## Problem

Issue #61 requires a reviewed Lab 4 release with reproducible setup, accurate
FR/BR/AC and test traceability, actual peer-review/CI/Project evidence, and one
readable PDF in Answer Part 1–9 order. The integrated implementation is on
`lab4-staging`, while remote `main` still contains the Lab 3 release. Several
documentation statuses and API response descriptions were historical, and the
verification runner needed separate candidate/final-main evidence with preserved
run logs.

## Changes

- Update README structure, current role behavior, actual seed fixtures, setup,
  demo and release verification instructions. Reconcile API event/envelope/user
  summaries with source and mark the implemented specification's remaining final
  release gate explicitly.
- Record all nine actual peer approvals for PRs #62–70 at their final heads,
  material findings/responses and CI URLs. Capture the real public Kanban,
  staging CI and PR approval; #52–60 are Done while #61 remains In progress.
- Add a safe fresh-clone setup audit, named immutable verification runs, a strict
  complete final-main gate, source-file re-enumeration and screenshot/database
  evidence archives. Save hosted CI reports under the current run ID and record
  executed test-step outcomes, checkout SHA and source hashes.
- Prepare a single 21-page A4 PDF using the supplied Lab 1/2/3 report examples:
  exact nine sections, Thai font, clickable links, readable screenshot excerpts
  from unmodified original images, metric predicates, traceability and ten actual
  key prompts with an AI-assisted reflection draft.
- Add editable report data/template, PDF image/hash/link manifest and an export
  gate that independently verifies the complete final-main manifest and current
  source. The candidate PDF visibly labels final-main evidence as pending.

## Validation

Local candidate verification on **2026-10-03, 22:11–22:20 Asia/Bangkok**, on
`chore/lab4-release-preparation` based on `bab4fc1`, passed **19/19 commands** with
`sourceUnchangedDuringRun: true` and `allChecksPassed: true`.

| Check | Actual result |
|---|---|
| Server regression | **39 files / 586 tests passed** |
| Client regression | **22 files / 170 tests passed** |
| Required Lab 4 live E2E | **14 passed**: Actions 7, workflow 3, dashboards 4 |
| Labs 1–3 browser regression | **18 passed** |
| UI/keyboard/accessibility audit | **13 passed**, 63 fixture screenshot/JSON pairs |
| Dashboard p95 / 500 ms budget | Requester **13.03 ms**, Staff **17.30 ms**, Admin **15.83 ms** |
| Lint/build/Prisma | **Passed** |

The manifest, raw logs, JSON reports, fresh direct database proof and **159
screenshots** are archived in `artifacts/lab-04/issue-61/release-candidate/`.
Runtime file hashes identify the verified worktree in addition to its baseline
commit; these are local candidate results, not final-main evidence.

Fresh-clone setup passed dependency installation, Prisma generate/migrate,
two seed runs with unchanged records/credentials, both builds and API health
`200`. The demo contained 10 Users, 8 Tickets and 6 Actions. The audit also passed
with an inherited `SEED_REFERENCE_DATA_ONLY=true`, because it explicitly enables
the documented full demo seed. Only its disposable test schema was removed.

All **31 external PDF URLs** returned HTTP `200`; all six review/comment anchors
exist. Checks and exact PDF/manifest hashes are recorded in
`artifacts/lab-04/issue-61/pdf-link-checks.json`.
The links refer to the currently published approved staging evidence; newly
prepared release documentation must be published and its final-main links updated
before submission. The PDF and verification final gates correctly reject the
current candidate as final-main evidence.

An earlier exploratory run completed all 19 commands, but release-tool changes
occurred during it. Its manifest remains in `artifacts/lab-04/issue-61/candidate/`
with `sourceUnchangedDuringRun: false` and `allChecksPassed: false`; it is retained
as diagnostic evidence rather than a passing release run.

**Still required for Issue #61 acceptance:** release-preparation and
staging-to-main PR review/CI, integration into main, exact-SHA final-main tests/CI,
student personalization of reflection, final Project/Kanban capture and final
PDF export. Independent manual zoom/screen-reader inspection remains unperformed
and is disclosed as a limitation. Local candidate
results and historical feature approvals do not establish these gates.

## Dependencies

Requires merged PRs #62–70 on `lab4-staging` at
`bab4fc1992d0d11b523cf9a3ad90d0ed09ff5e5d`. Integrated staging CI
[#88](https://github.com/L0u1sss/TokTickIT/actions/runs/37129764540) passed.

Branch flow: `chore/lab4-release-preparation → lab4-staging → main`.
The preparation PR uses a non-closing reference so merging preparation cannot
close the release issue before post-merge verification and PDF acceptance.

Reference: `SE+Lab+4.pdf`, §§11–14 and required Answer Part 1–9. Description follows
previous PRs' Problem / Changes / Validation / Dependencies structure.

Refs #61
