# Issue #61 release-candidate results

The unchanged-source candidate run completed on **2026-10-03, 22:11–22:20
Asia/Bangkok** on `chore/lab4-release-preparation`, baseline commit
`bab4fc1992d0d11b523cf9a3ad90d0ed09ff5e5d`. The manifest records the worktree status
and runtime source hashes, so the baseline commit alone is not presented as the
tested release-tool implementation.

| Check | Result |
|---|---|
| Complete verification | **19/19 PASS**, source unchanged |
| Server | **39 files / 586 tests PASS** |
| Client | **22 files / 170 tests PASS** |
| Browser | **45 PASS** — real Lab 4 14, Labs 1–3 18, fixture UI audit 13 |
| Lint/build/Prisma | **PASS** |
| Performance p95 | Requester **13.03 ms**, Staff **17.30 ms**, Admin **15.83 ms**; budget 500 ms, 1,000 Tickets/5,000 Actions |
| Fresh clone | **PASS** — install/generate/migrate/two seeds/build/health; 10 Users/8 Tickets/6 Actions; credentials/records unchanged |
| Negative guards | Candidate final-main verification, duplicate run, local hosted-CI recorder and final PDF export all rejected as expected |
| Report | One **21-page** A4 candidate PDF; exact nine parts; Thai embedded font; 13 original-image excerpts; clickable links |
| PDF links | **31/31 HTTP 200**, six review/comment anchors present |

- [Full candidate manifest](../../artifacts/lab-04/issue-61/release-candidate/verification.json)
- [Machine-readable summary](../../artifacts/lab-04/issue-61/results-summary.json)
- [Fresh-clone manifest](../../artifacts/lab-04/issue-61/fresh-clone/verification.json)
- [Archived real database-count proof](../../artifacts/lab-04/issue-61/release-candidate/screenshots/lab-04/staff-dashboard/database-counts.json)
- [PDF/image/hash manifest](../../artifacts/lab-04/issue-61/pdf-manifest.json)
- [External link checks](../../artifacts/lab-04/issue-61/pdf-link-checks.json)
- [Actual reviews/CI/Project snapshot](reviewer.md#issue-61-github-review-and-integration-snapshot--2026-10-03)

The archive retains **159 screenshots** from Labs 3/4 and 63 fixture JSON pairs.
The dashboard JSON was produced by direct Prisma queries during this run and
compared with the API/UI in the authenticated browser suite; it is separate from
injected zero/error UI states. The full logs and JSON reports remain unchanged.

The earlier exploratory `candidate/verification.json` completed all commands but
runtime sources changed while the release tools were corrected. Its
`sourceUnchangedDuringRun: false` and `allChecksPassed: false` are preserved.
The later complete `release-candidate/` run above used the corrected, frozen
sources. The initial fresh-clone attempt is retained in `fresh-clone-initial/`;
the final fresh-clone run additionally proved that an inherited reference-only
seed setting cannot skip the documented full demo.

This prepares the release for review. **Release PR approvals, staging-to-main
integration, exact-SHA final-main tests/CI, final Project state and final PDF
acceptance remain pending.** The student's personal reflection needs review;
independent manual zoom/screen-reader inspection remains an explicit limitation.
