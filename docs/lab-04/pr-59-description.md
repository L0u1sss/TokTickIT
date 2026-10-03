## Problem

Lab 4 requires traceable evidence that Actions Taken, the final Ticket lifecycle and role dashboards work together while preserving Labs 1–3. The test plan still referenced proposed files that did not exist, and dashboard performance had no measured evidence.

## Changes

- Reconcile `tests.md` with actual API, component and E2E files; map FR/BR/AC to executed results and keep release/manual evidence explicitly pending.
- Add all 64 Ticket transition pairs as unit checks and all 16 Action transition pairs through the authenticated API, including rejected-write atomicity and Unicode code-point boundaries.
- Add claim/reassign/priority stale-version and concurrent-writer tests, cross-operation conflict/retry checks, and cancellation races against Action creation, editing and completion.
- Verify Requester dashboard/drill-down half-open windows at Bangkok and UTC midnight, alongside existing ownership, zero metrics, ordering, attribution and direct database comparisons.
- Strengthen populated Lab 3 migration/repeated-seed and guarded rollback/forward-recovery tests with full legacy User, Ticket, Attachment, Public Comment and Internal Note comparisons.
- Define and measure dashboard performance on exactly 1,000 Tickets / 5,000 Actions: five warm-ups and 40 sequential requests per role, nearest-rank p95 ≤500 ms. Run separately from regression.
- Add `scripts/verify-lab4.mjs` to run all checks sequentially and record command exits, timestamps, baseline commit, tested source SHA-256 hashes, raw logs and Vitest reports. Extend CI with the performance step and JSON evidence uploads; update README and AI-use evidence.
- Refresh Lab 4 screenshots/database evidence and representative Labs 1–3 browser screenshots through the existing suites.

## Validation

Local full verification on **2026-10-03, 18:18–18:28 Asia/Bangkok**:

| Check | Actual result |
|---|---|
| Server regression | **39 files / 586 tests passed** |
| Client regression | **22 files / 161 tests passed** |
| Required Lab 4 E2E | **14 passed**: Actions Taken 7, Ticket resolution 3, dashboards 4 |
| Labs 1–3 browser regression | **18 passed**: authentication 1, administration 1, staff queue 1, staff workflow 1, communications 1, responsive 6, requester/attachment/ownership/retry/accessibility 7 |
| Dashboard performance | **Passed**: Requester p95 **31.73 ms**, IT Staff **75.12 ms**, Administrator **42.71 ms**; budget 500 ms |
| Server/client lint and build; Prisma validation | **Passed** |
| Migration, recovery and repeated seed | **3 integration tests passed**, included in server regression |

[Detailed traceability](tests.md#issue-59-verification), [full verification manifest](../../artifacts/lab-04/issue-59/verification.json), [server results](../../artifacts/lab-04/issue-59/server-results.json), [client results](../../artifacts/lab-04/issue-59/client-results.json), [performance samples](../../artifacts/lab-04/issue-59/dashboard-performance.json).

These results apply to the uncommitted worktree on `test/lab4-e2e-and-regression`, based on `54238fec9b6a1bab1ad3d50e72656214aa086ba9`; tested source hashes remained unchanged throughout the full run. They are not test results on the baseline commit alone. Hosted CI on the final PR head, independent peer review, manual browser zoom/screen-reader checks and final-main/PDF release verification remain pending. Earlier feature PR CI is historical evidence.

## Dependencies

Requires the integrated Actions Taken UI/API, Ticket workflow, Requester Dashboard and Staff/Administrator Dashboard already present on `lab4-staging`. Branch flow: `test/lab4-e2e-and-regression → lab4-staging → main`.

Reference: `SE+Lab+4.pdf`, §5, §8.5, §10, §12 and Answer Parts 3/8. Structure follows previous PRs #64 and #68.

Refs #59
