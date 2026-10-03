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


## PR #68 Staff Dashboard Follow-up ? 2026-10-03

- Pull request: https://github.com/L0u1sss/TokTickIT/pull/68
- Feature branch: `feat/lab4-staff-dashboard`; merged staging dependency: `cd66073`; merge commit: `baa49c8`; implementation: `378c8e0`.
- Reviewer/approval: Pending. GitHub PR conversation, inline comments, review submissions and review threads returned no review entries when read for this task. No peer approval is claimed.
- Scope verified against the handout: authoritative operational metrics, concise bounded summaries, current-user attribution union under BR-28, role navigation/access, exact Queue drill-down, Action deep links, loading/zero/safe failures/retry and responsive automated evidence.
- Local test results and evidence: [PR #68 validation](./tests.md#pr-68-validation). Local passing results do not establish hosted CI or final-main release approval.
