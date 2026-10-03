# TokTickIT Lab 4 — Peer Review Record

## PR #66 Workflow Contract Follow-up — 2026-10-03

- Pull request: https://github.com/L0u1sss/TokTickIT/pull/66
- Branch: `feat/lab4-ticket-workflow`; staging dependency: `7102116`.
- Reviewer and approval: Pending. No review comments or inline review threads were returned by the GitHub read performed for this follow-up.
- Local verification: [test record](./tests.md#pr66-validation). Local tests are not peer approval or hosted CI.

Follow-up checks against the Lab 4 handout and current engineering contract identified the earlier timestamp-only concurrency contract and minimum-only resolution gate as incompatible with the merged Action APIs. The implementation now shares integer Ticket versions and parent locking, checks current-cycle completed work/active work/follow-up, and preserves cancellation/reopen provenance and history. The client, regression fixtures, workflow browser evidence and CI command use the same contract. Peer review should verify the final pushed head before approval; no approval is claimed here.

> This file records real review evidence only. Do not invent reviewer identity, comments, approvals, test results, or links.

## Contract Review — Issue #52

- Branch: `docs/lab4-engineering-contract`
- Issue: https://github.com/L0u1sss/TokTickIT/issues/52
- Pull request: [#62 — docs(lab-04): define Sprint 4 engineering contract and traceability](https://github.com/L0u1sss/TokTickIT/pull/62)
- Reviewed head at request-changes review: `cad940e521072cfe521fb96d3d615116ac384840`
- Latest reviewed head: `f154169cdb2cf9bb3180bb380de32bd4ba2eeab3`
- Most recent reviewed head: `6851cc919e5350ff4c8b0373823e09da9a5c7219`
- Reviewer: Tanaboonnnnn
- Review status: Three review rounds have requested changes; latest contract updates in progress; re-review pending

### Review focus

- [ ] Action performer, assignee, status, edit, and append-only audit decisions are internally consistent.
- [ ] Resolution gate is testable and does not treat Requester advisory as formal resolution.
- [ ] Dashboard metrics have exact authoritative formulas, ordering, zero behavior, and drill-down.
- [ ] Authorization matrix protects ownership and Internal Notes.
- [ ] Migration preserves Lab 3 records and has tested recovery guidance.
- [ ] Every Acceptance Criterion maps to planned evidence.
- [ ] Scope excludes unapproved notifications, SLA, inventory, billing, approvals, BI, tenancy, and cloud operations.

## Review Comments and Responses

| Date | Reviewer | PR/comment link | Comment | Response/change | Resolution |
|---|---|---|---|---|---|
| 2026-09-29 | Tanaboonnnnn | [Review 5350109562](https://github.com/L0u1sss/TokTickIT/pull/62#pullrequestreview-5350109562) | Clarify terminal Action lifecycle; strengthen the current-cycle resolution gate; justify Ticket concurrency token and define atomicity; serialize parent/Action races; define recently-resolved window; specify requester multi-status drill-down; define My Actions membership; constrain destructive migration recovery; refresh PR evidence; verify test commands and planned paths | Contract changes recorded across specification, API, UI, and test plan; awaiting reviewer confirmation | Changes requested; re-review pending |
| 2026-09-29 | Tanaboonnnnn | [Review 5350346761](https://github.com/L0u1sss/TokTickIT/pull/62#pullrequestreview-5350346761) | Define `performedBy` as the assignee who alone may complete; correct BR-42's exception reference; require the same Ticket version token for claim, owner, priority, status, and Action writes | Contract changes recorded across specification, API, UI, and test plan; awaiting reviewer confirmation | Changes requested; re-review pending |
| 2026-09-29 | Tanaboonnnnn | [Review 5350911804](https://github.com/L0u1sss/TokTickIT/pull/62#pullrequestreview-5350911804) | Model Action cancellation provenance and cascade revision/event semantics; serialize and test assignee-reassignment versus completion; define Ticket `updatedAt` changes and Recently Updated behavior | Contract changes recorded across specification, API, UI, and test plan; awaiting reviewer confirmation | Changes requested; re-review pending |

## Verification Reviewed

| Commit SHA | CI/test link | Scope | Result verified by reviewer |
|---|---|---|---|
| Pending | Pending | Contract documentation checks | Pending |

## Approval

Approval is not yet received. Keep reviewer approval and test results Pending until independently recorded; this response entry does not imply approval. Update the reviewed head SHA after the revised contract is committed and submitted for re-review.

## Sprint 4 Follow-up Reviews

Implementation PRs must append their real review links and resolved material findings here or link to a dedicated evidence section. The final release audit confirms that approvals correspond to the final implementation rather than an obsolete commit.


## PR #68 Staff Dashboard Follow-up - 2026-10-03

- Pull request: https://github.com/L0u1sss/TokTickIT/pull/68
- Feature branch: `feat/lab4-staff-dashboard`; merged staging dependency: `cd66073`; merge commit: `baa49c8`; implementation: `378c8e0`.
- Reviewer/approval: Pending. GitHub PR conversation, inline comments, review submissions and review threads returned no review entries when read for this task. No peer approval is claimed.
- Scope verified against the handout: authoritative operational metrics, concise bounded summaries, current-user attribution union under BR-28, role navigation/access, exact Queue drill-down, Action deep links, loading/zero/safe failures/retry and responsive automated evidence.
- Local test results and evidence: [PR #68 validation](./tests.md#pr-68-validation). Local passing results do not establish hosted CI or final-main release approval.

## PR #68 Review 5400210287 - 2026-10-03

- Reviewer: **Tanaboonnnnn**; [review 5400210287](https://github.com/L0u1sss/TokTickIT/pull/68#pullrequestreview-5400210287), submitted `2026-10-03T10:11:55Z` (17:11:55 Asia/Bangkok).
- Reviewed head: `5aa91122eaaede3ab3de4232d36bc2148c467577`; result: **Changes requested**. This review has no inline comments.
- Baseline [CI run #82](https://github.com/L0u1sss/TokTickIT/actions/runs/37114919659) passed on that reviewed head. This does not verify the subsequent review fixes.

| Finding | Implemented response | Review status |
|---|---|---|
| HIGH-only preview was presented as Urgent Tickets | Use the reviewer's alternative **High Priority Tickets** in the UI and current contract. Keep the `urgentTickets` wire key for compatibility and document its exact all-status `itPriority=HIGH` predicate, oldest-update ordering and five-row limit. Tests check heading, HIGH rows, terminal inclusion, tie ordering and links. | Implemented; re-review pending |
| `generatedAt` was created after database queries | Capture once before the repeatable-read transaction, matching the Requester pattern. A fixed-clock regression advances time at transaction execution and verifies the captured value remains unchanged. Document request capture time separately from query completion and database snapshot time. | Implemented; re-review pending |
| PR metadata and current contract needed consistent terminology | Align specification, API, UI, README, test plan, browser evidence and PR body with High Priority Tickets and the timestamp contract. | Implemented; re-review pending |

Verification is recorded in [review-fix validation](./tests.md#pr68-review-5400210287). Reviewer approval remains pending; implementation and local passing checks do not imply approval or final-main release validation.

## Issue #61 GitHub Review and Integration Snapshot — 2026-10-03

This section supersedes the earlier **Pending** review statuses for PRs #62, #66 and #68 as of the release audit. The previous sections retain observations from the time those reads occurred. The authoritative read-only snapshot contains the actual REST PR metadata, review submissions, conversation responses, inline comments, workflow runs and public Project data: [GitHub snapshot](../../artifacts/lab-04/issue-61/github-snapshot.json). PR/review/CI data was fetched at `2026-10-03T14:47:10Z`; the public Project was fetched at the later timestamp recorded under `resources.project.fetched_at_utc`.

All nine Lab 4 feature PRs were merged into `lab4-staging`. **Tanaboonnnnn** submitted an **APPROVED** review for each, and every approval's `commit_id` equals that PR's final head SHA. These are actual feature approvals. They do not approve the subsequent release-preparation branch or the eventual integration PR into `main`.

### Approved feature heads and hosted CI

| PR / scope | Final approved head SHA | Actual approval | CI on that PR head |
|---|---|---|---|
| [#62 — engineering contract](https://github.com/L0u1sss/TokTickIT/pull/62) | `adc5c8f5878c85723e997af7cfdf1c13f5b3ea0b` | [Tanaboonnnnn, 2026-09-29](https://github.com/L0u1sss/TokTickIT/pull/62#pullrequestreview-5351094463) | No hosted workflow run returned for this exact head |
| [#63 — data model and migration](https://github.com/L0u1sss/TokTickIT/pull/63) | `9caa6ef473186e5993ff629d4022e3a31d150d6d` | [Tanaboonnnnn, 2026-09-30](https://github.com/L0u1sss/TokTickIT/pull/63#pullrequestreview-5367134740) | No hosted workflow run returned for this exact head |
| [#64 — Actions API](https://github.com/L0u1sss/TokTickIT/pull/64) | `3c009951b7c3a6d2ffdae3791572dd1b9cadc8be` | [Tanaboonnnnn, 2026-10-01](https://github.com/L0u1sss/TokTickIT/pull/64#pullrequestreview-5386206703) | No hosted workflow run returned for this exact head; approval explicitly distinguishes local evidence |
| [#65 — Actions UI](https://github.com/L0u1sss/TokTickIT/pull/65) | `754e9ab3d1f5b9d17ab5e44e563d38b1bf996dea` | [Tanaboonnnnn, 2026-10-02](https://github.com/L0u1sss/TokTickIT/pull/65#pullrequestreview-5396377022) | [Run #71 — success](https://github.com/L0u1sss/TokTickIT/actions/runs/37056328047) |
| [#66 — Ticket workflow](https://github.com/L0u1sss/TokTickIT/pull/66) | `fcf839ae4f66a34b55670591f1b4a5c434ae88c6` | [Tanaboonnnnn, 2026-10-02](https://github.com/L0u1sss/TokTickIT/pull/66#pullrequestreview-5397176233) | [Run #73 — success](https://github.com/L0u1sss/TokTickIT/actions/runs/37063678767) |
| [#67 — Requester dashboard](https://github.com/L0u1sss/TokTickIT/pull/67) | `d05ebe0b54d84ed305faa7f323475e05945295b8` | [Tanaboonnnnn, 2026-10-03](https://github.com/L0u1sss/TokTickIT/pull/67#pullrequestreview-5400000466) | [Run #79 — success](https://github.com/L0u1sss/TokTickIT/actions/runs/37112281117) |
| [#68 — Staff/Admin dashboard](https://github.com/L0u1sss/TokTickIT/pull/68) | `1bb967000c0208ff04bd239c0ab034afa2f3788a` | [Tanaboonnnnn, 2026-10-03](https://github.com/L0u1sss/TokTickIT/pull/68#pullrequestreview-5400376688) | [Run #83 — success](https://github.com/L0u1sss/TokTickIT/actions/runs/37117032963) |
| [#69 — verification and regression](https://github.com/L0u1sss/TokTickIT/pull/69) | `6c4080667eda60e7ea37ce01b3a6b8325e74132d` | [Tanaboonnnnn, 2026-10-03](https://github.com/L0u1sss/TokTickIT/pull/69#pullrequestreview-5400646919) | [Run #85 — success](https://github.com/L0u1sss/TokTickIT/actions/runs/37120539752) |
| [#70 — UI/accessibility/failure recovery](https://github.com/L0u1sss/TokTickIT/pull/70) | `0c4491830650fb920304b1034f78a5f3942dfc73` | [Tanaboonnnnn, 2026-10-03](https://github.com/L0u1sss/TokTickIT/pull/70#pullrequestreview-5401218381) | [Run #87 — success](https://github.com/L0u1sss/TokTickIT/actions/runs/37125185177) |

The combined staging commit is `bab4fc1992d0d11b523cf9a3ad90d0ed09ff5e5d` (merge of PR #70). Its push-triggered [CI run #88](https://github.com/L0u1sss/TokTickIT/actions/runs/37129764540) completed with **success**, verifying the integrated tree including the earlier PRs. A successful staging run is recorded separately from peer approval and final-main verification. Direct workflow queries for the exact heads of PRs #62–#64 returned zero runs; later passing staging CI does not retroactively create feature-head CI.

### Material review findings and author responses

| PR | Actual review finding | Author response or recorded fix | Reviewer confirmation |
|---|---|---|---|
| #62 | [Three request-changes rounds](https://github.com/L0u1sss/TokTickIT/pull/62#pullrequestreview-5350911804) addressed terminal Actions, assignee-only completion, aggregate version/locking, cancellation provenance, dashboard timing and traceability. | [Contract response](https://github.com/L0u1sss/TokTickIT/pull/62#issuecomment-5887296088), [version/performer response](https://github.com/L0u1sss/TokTickIT/pull/62#issuecomment-5888016980), [cancellation/race/timing response](https://github.com/L0u1sss/TokTickIT/pull/62#issuecomment-5888242369). | [Approval 5351094463](https://github.com/L0u1sss/TokTickIT/pull/62#pullrequestreview-5351094463) accepted the revised contract; PR-body cleanup was non-blocking. |
| #63 | [Migration review](https://github.com/L0u1sss/TokTickIT/pull/63#pullrequestreview-5352763690) and [audit-history follow-up](https://github.com/L0u1sss/TokTickIT/pull/63#pullrequestreview-5357376230) required nullable completion performer, recorder separation, cycle/version/provenance, append-only audit and safe recovery. | [Schema/migration response](https://github.com/L0u1sss/TokTickIT/pull/63#issuecomment-5896209790), [audit-history response](https://github.com/L0u1sss/TokTickIT/pull/63#issuecomment-5899452436). | [Approval 5367134740](https://github.com/L0u1sss/TokTickIT/pull/63#pullrequestreview-5367134740) confirmed the revisions and tests. |
| #64 | [API review](https://github.com/L0u1sss/TokTickIT/pull/64#pullrequestreview-5376112418), [replay/race follow-up](https://github.com/L0u1sss/TokTickIT/pull/64#pullrequestreview-5377226817) and [verification follow-up](https://github.com/L0u1sss/TokTickIT/pull/64#pullrequestreview-5377952192) required contract-correct lifecycle/attribution, immutable create intent, parent-first locking, proper replay shape and same-head verification. | [Core contract response](https://github.com/L0u1sss/TokTickIT/pull/64#issuecomment-5927325737), [replay/race response](https://github.com/L0u1sss/TokTickIT/pull/64#issuecomment-5928972030), [actual verification response](https://github.com/L0u1sss/TokTickIT/pull/64#issuecomment-5929816198). | [Approval 5386206703](https://github.com/L0u1sss/TokTickIT/pull/64#pullrequestreview-5386206703) accepted correctness and local verification, preserving the absence of hosted CI and the deferred resolution-gate scope. |
| #65 | [UI metadata review](https://github.com/L0u1sss/TokTickIT/pull/65#pullrequestreview-5395947119) and [PR-body follow-up](https://github.com/L0u1sss/TokTickIT/pull/65#pullrequestreview-5396245371) required terminal lifecycle wording, current test counts, hosted evidence and explanation of test infrastructure changes. | [Evidence/lifecycle response](https://github.com/L0u1sss/TokTickIT/pull/65#issuecomment-5960348888), [PR-description response](https://github.com/L0u1sss/TokTickIT/pull/65#issuecomment-5960595226). | [Approval 5396377022](https://github.com/L0u1sss/TokTickIT/pull/65#pullrequestreview-5396377022) confirmed metadata and exact-head CI. |
| #66 | [Workflow review](https://github.com/L0u1sss/TokTickIT/pull/66#pullrequestreview-5396956942) required PR metadata to match integer Ticket versions, complete current-cycle resolution gates, cascade/reopen behavior and evidence counts. | [Author response](https://github.com/L0u1sss/TokTickIT/pull/66#issuecomment-5961760492) records the description correction; the implementation head remained unchanged. | [Approval 5397176233](https://github.com/L0u1sss/TokTickIT/pull/66#pullrequestreview-5397176233) confirmed the corrected metadata and run #73. |
| #67 | [Requester dashboard review](https://github.com/L0u1sss/TokTickIT/pull/67#pullrequestreview-5399755207) required role-home navigation, legacy query regression, exact pagination assertions and fresh database/browser provenance. | [Author response](https://github.com/L0u1sss/TokTickIT/pull/67#issuecomment-5967699985) records route, regression, evidence and PR-description revisions. | [Approval 5400000466](https://github.com/L0u1sss/TokTickIT/pull/67#pullrequestreview-5400000466) accepted all seven findings. |
| #68 | [Staff dashboard review](https://github.com/L0u1sss/TokTickIT/pull/68#pullrequestreview-5400210287) required High Priority wording to match the HIGH predicate and a single request timestamp captured before the read transaction. | Changes and tests are recorded in the preceding review-fix table and [validation section](./tests.md#pr68-review-5400210287). No separate author conversation response exists in the snapshot. | [Approval 5400376688](https://github.com/L0u1sss/TokTickIT/pull/68#pullrequestreview-5400376688) independently confirmed fixes on `1bb9670` and run #83. |
| #69 | [Verification review](https://github.com/L0u1sss/TokTickIT/pull/69#pullrequestreview-5400646919) found no blocking findings; a React test warning was noted as optional cleanup. | No requested changes or author response were needed for this PR. | Actual **APPROVED** review on `6c40806`; run #85 succeeded. |
| #70 | [UI audit review](https://github.com/L0u1sss/TokTickIT/pull/70#pullrequestreview-5401218381) accepted implementation, accessibility/failure evidence and honest same-source rerun provenance; large diagnostic artifacts were non-blocking. | No requested changes or author response were needed for this PR. | Actual **APPROVED** review on `0c44918`; run #87 succeeded. |

REST returned zero inline review comments for each PR #62–#70. Request-changes findings are review-submission bodies followed by approving reviews; the snapshot does not claim a separate GraphQL resolved-thread audit. Conversation invitations from other identities are not approvals, and the author's own **COMMENTED** review on PR #66 is not independent approval.

### Project/Kanban and final release status

The fresh public [toktikit kanban](https://github.com/users/L0u1sss/projects/7) data confirms Issues **#52–#60 are closed and Done**; Issue **#61 is open and In progress** with no linked release PR at snapshot time. The whole board contains 31 Done items and one In progress item, with zero Backlog/Ready/In review items. Individual Lab 4 item IDs, status values and timestamps are stored under `resources.project.data.lab4_statuses` in the snapshot. Cached issue HTML returned older states for #59/#60, so this record uses fresh REST issue states and fresh Project embedded JSON.

At this snapshot, remote `main` is still `2a4b172682c610202bb72eb6cb64f3e62730a48e`, the prior Lab 3 documentation merge. Its [CI run #66](https://github.com/L0u1sss/TokTickIT/actions/runs/35542544577) is historical Lab 3 evidence. **Release-preparation PR approval, `lab4-staging → main` integration approval/merge, final Lab 4 main SHA and final-main CI/tests remain pending.** Keep Issue #61 open until these steps, final Project evidence and the single PDF submission are completed. Preparation PRs should use a non-closing reference to #61 so preparation alone cannot imply final-main completion.

Actual public GitHub pages were captured through Playwright Chromium at 1920×1100 on 2026-10-03: [Project board](../../artifacts/lab-04/issue-61/github/project-kanban.png), [staging CI #88](../../artifacts/lab-04/issue-61/github/staging-ci-88.png), [merged PR #70](../../artifacts/lab-04/issue-61/github/pr70-merged.png), [PR #70 approval and merge event](../../artifacts/lab-04/issue-61/github/pr70-approval.png), and [main/staging comparison](../../artifacts/lab-04/issue-61/github/main-staging-comparison.png). The comparison page reports 50 commits / 416 changed files and an automatic merge is possible at capture time; this is branch-comparison evidence, not a completed merge. [Capture metadata](../../artifacts/lab-04/issue-61/github/capture-metadata.json) records URLs, timestamps, HTTP 200 results, page text and image SHA-256 hashes. No GitHub content or page styling was modified. The initial capture attempt's PR-review selector error remains in [initial metadata](../../artifacts/lab-04/issue-61/github/capture-metadata-initial.json); the corrected capture succeeded.
