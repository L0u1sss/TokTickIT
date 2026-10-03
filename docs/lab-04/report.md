# TokTickIT Lab 4 submission report

Student ID: **67070507212**. The reference PDF metadata names
**PHALAT AMACHAYAPHA**; no Thai spelling was inferred.

The single report is [SE-Lab4-67070507212.pdf](SE-Lab4-67070507212.pdf).
Its editable content is [report-data.json](report-data.json) and its layout is
[report-template.html](report-template.html). It follows the sample reports'
white A4 pages, green headings, concise Thai explanations, explicit GitHub links
and readable screenshots, without a separate cover.

**Current status: release candidate.** The PDF labels final-main verification as
pending until the reviewed staging release is integrated and tested on `main`.
Historical feature-head and staging CI remain clearly identified.

## Answer Part 1: Git Use with Engineering Workflow

Repository, Issue #61, Project #7, feature/staging/main history, actual peer reviews
and staging CI are linked. The Project screenshot shows the truthful current
state: #52–60 Done and #61 In progress.

## Answer Part 2: Spec DD

Summarizes FR/BR/AC and the explicit project decisions for Action assignee/performer,
append-only events, aggregate concurrency, resolution gates and dashboard formulas.
The full specification/API/UI contracts remain the source of truth.

## Answer Part 3: Test DD and Traceability

Records the new candidate's full command results, unit/component/browser counts,
AC-to-file mapping, fresh-clone proof and performance measurements. Final-main
results must come from the `--require-main` manifest, rather than relabeling these
candidate results.

## Answer Part 4: AI Use with Reflection

Selects ten actual key requests from the AI-use archive, identifies Codex/GPT-6
and the specification/coding/review roles, and explains checked decisions and
observed failures. The student's review of the personal reflection remains
explicitly required.

## Answer Part 5: Working IT Staff Dashboard UI

Staff/Admin metrics and attribution are compared with direct Prisma queries.
Screenshots show real API results, role navigation and drill-down.

## Answer Part 6: Working Actions Taken UI

Live evidence shows planned/assigned work, edit controls, completion/cancellation,
immutable terminal history and inactive-assignee rejection/recovery.

## Answer Part 7: Working Ticket Workflow

Shows the enforced resolution gate, resolved/closed/reopened states and cancellation
provenance. Requester resolution indication remains advisory.

## Answer Part 8: Working Requester Dashboard and Final Regression UI

Requester metrics, recently resolved bounds, ownership and exact filter drill-down
are linked to database evidence and Labs 1–3 regression results.

## Answer Part 9: Zen Green UI, Responsive, Accessibility, and Final Polish

Shows live and fixture evidence with source captions. Automated axe, keyboard,
modal/focus, long-content geometry and mobile target checks are distinguished
from pending independent manual zoom/screen-reader review.

## Build and verify

Run from the repository root after installing client dependencies and Chromium:

```powershell
node scripts/build-lab4-report.mjs
```

This produces the single PDF, a standalone HTML preview and
`artifacts/lab-04/issue-61/pdf-manifest.json` with image hashes and PDF links/page
count. Candidate status is visible on every page.

After completing the [release gates](release-audit.md#release-completion-sequence),
update the report data's branch/SHA/main SHA, verification manifest, actual CI/review
links, screenshots and final Project state, then run:

```powershell
node scripts/build-lab4-report.mjs --final
```

The final build must use the current verified `main` checkout and the complete
same-source final-main manifest. A flag alone cannot convert candidate evidence
into final-main evidence. Recheck PDF readability and working links after export.
