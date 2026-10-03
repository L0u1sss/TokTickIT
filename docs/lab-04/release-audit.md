# Lab 4 release audit — Issue #61

This audit separates the reviewed Lab 4 implementation, release-candidate checks,
and the final-main submission gate. The current preparation branch is
`chore/lab4-release-preparation`, based on integrated staging commit
`bab4fc1992d0d11b523cf9a3ad90d0ed09ff5e5d`.

## Requirement and evidence audit

| Handout / issue requirement | Evidence and audit outcome | Status |
|---|---|---|
| FR-01–06; Actions assignment/edit/start/complete/cancel | `server/tests/lab-04/actions-taken.api.test.ts`, `client/tests/lab-04/ActionsTaken.test.tsx`, `client/e2e/lab-04/actions-taken-flow.spec.ts`; live flow also rejects an inactive assignee, retains the draft and recovers after reload | Implemented and reviewed; candidate run recorded separately |
| FR-07–08; eight-state Ticket workflow | `server/tests/lab-04/ticket-workflow.test.ts`, `client/e2e/lab-04/ticket-resolution.spec.ts`; integer aggregate version, current-cycle resolution gate, advisory-only Requester indication, cancellation provenance and preserved reopen history | Implemented and reviewed |
| FR-09–11; authoritative dashboards | Independent Prisma queries in `client/scripts/run-auth-e2e.mjs` are compared with API responses, rendered metrics and drill-down in `client/e2e/lab-04/dashboards.spec.ts`; database-count JSON includes run/schema/time/SHA | Implemented and reviewed; fresh JSON archived with candidate run |
| FR-12; additive migration/repeated seed | `server/tests/lab-04/migration.test.ts` plus [fresh clone verification](../../artifacts/lab-04/issue-61/fresh-clone/verification.json) | Fresh clone passed; populated migration remains in full suite |
| FR-13; safe validation/conflict/retry | Real API/component/live Action suites and explicitly marked UI fixtures in `client/e2e/lab-04/ui-hardening.spec.ts` | Implemented and reviewed |
| FR-14; Labs 1–3 continuity | Full server/client suites and authentication/admin/queue/staff/communication/responsive/Requester browser runners | Candidate/final-main manifests establish the exact run scope |
| FR-15; responsive/keyboard/visual/accessibility | [UI checklist](ui-spec.md#issue-60-visual-and-accessibility-evidence), live screenshots and 63 fixture screenshot/JSON pairs; automated reflow is distinguished from manual zoom | Automated evidence available; independent manual zoom/screen-reader inspection pending |
| Repository structure / fresh setup | Updated [README](../../README.md); locked dependencies, generate/deploy/seed/repeated seed/build/health checked from a committed fresh clone with a disposable test schema | PASS — actual fresh clone log |
| Specification/API/UI/test documentation | Audited current FR/BR/AC decisions, actual response fields, real test paths and local links; corrected historical README scope and API event description | Updated |
| Review identity/comments/responses/approval | [Authoritative GitHub snapshot](reviewer.md#issue-61-github-review-and-integration-snapshot--2026-10-03); all PRs #62–70 approved at their final heads; staging CI #88 passed | Dependencies complete; release PR approvals pending |
| AI disclosure / 6–10 key prompts | [Selected ten prompts and reflection](ai-use.md#issue-61-submission-selection-and-reflection); archive retains earlier actual requests | Updated; student review of personal reflection still required |
| Project/Kanban | Fresh public Project #7 snapshot and actual Chromium screenshots; #52–60 Done, #61 In progress | Correct current status; final completion capture pending |
| Single nine-part PDF | [Report source and build](report.md); A4, Thai font, explicit links, preserved screenshot aspect ratios, draft status on every page | Candidate PDF prepared; final-main export pending |
| Final-main SHA/tests/CI and Product DoD | Main is still the Lab 3 commit `2a4b172682c610202bb72eb6cb64f3e62730a48e` at the snapshot | Pending reviewed release integration |

The assignment's under-specified assignee, editable projection versus append-only
history, resolution predicate, concurrency token and rolling seven-day window
are explicit project decisions in [specification §12](specification.md#12-assumptions-and-decisions).
No additional feature scope was inferred from the sample reports. The three sample
PDFs supplied by the user guide presentation only; the Lab 4 handout and approved
repository contracts govern behavior and evidence.

## Verification provenance

- [Fresh clone](../../artifacts/lab-04/issue-61/fresh-clone/verification.json): clones committed `bab4fc1` without copying existing dependencies or `.env`; installs both lockfiles, generates Prisma, deploys every migration into a disposable test schema, seeds twice with unchanged records/credentials, builds both applications and obtains health `200` from the newly built API. Connection strings are excluded from the saved logs. The clone is retained in the temporary path in the manifest; its test schema was removed.
- Candidate: the complete [release-candidate manifest](../../artifacts/lab-04/issue-61/release-candidate/verification.json) passed **19/19 commands**, server **39 files/586 tests**, client **22 files/170 tests**, and browser **45 tests**, with unchanged source hashes on 2026-10-03 22:11–22:20 Asia/Bangkok. The actual command was `node scripts/verify-lab4.mjs --issue=61 --run=release-candidate`; use a new name or omit `--run` to get a timestamp when rerunning. Each named run retains its own logs/reports and archives screenshots plus database JSON. An earlier exploratory run under `candidate/` completed 19 commands but source changed during tool review; its `allChecksPassed: false` is retained, not converted to a release pass.
- Final: `git fetch origin`, check out the reviewed final `main`, then run `node scripts/verify-lab4.mjs --issue=61 --run=final-main --require-main`. The final gate refuses another branch, a checkout that differs from `origin/main`, dirty runtime sources, or a partial suite. Runtime SHA-256 hashes must remain unchanged throughout the run.
- Hosted CI records actual checkout SHA, run URL, source hashes and unit/component reports in `artifacts/lab-04/issue-61/hosted-ci/<run-id>/provenance.json`. The workflow's final conclusion and exact commit remain authoritative.

## Release completion sequence

1. Review the concrete release-preparation changes and passing candidate evidence;
   merge the preparation PR into `lab4-staging` after its approval and CI.
2. Review and merge the release PR `lab4-staging → main` with passing CI.
   Use `Refs #61` while the final submission acceptance remains incomplete.
3. Fetch final `main`; run the full `--require-main` verification and verify its
   hosted main CI. Record the exact final SHA, reviews and working evidence links.
4. Review the personal reflection and any required visual/accessibility checks,
   retaining unperformed manual zoom/screen-reader checks as explicit limitations; update
   the report data to the actual final-main manifest and export the single PDF
   with `--final`. The generator rejects a candidate presented as final.
5. Confirm the PDF is readable and linked evidence exists on the submitted
   repository, then close #61, move it to Done and capture the final Kanban.
   Refresh the PDF's completion evidence against that actual state.

No approval, main merge, final-main pass, Done state or student-authored reflection
is inferred merely from a passing local candidate run.
