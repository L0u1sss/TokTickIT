# Lab 3 — Peer Review Record

> เอกสารนี้เก็บหลักฐาน review จริง ห้ามใส่ approval หรือ reviewer ที่ยังไม่เกิดขึ้น

- **Author:** [L0u1sss](https://github.com/L0u1sss)
- **Contract issue:** [#29](https://github.com/L0u1sss/TokTickIT/issues/29)
- **Branch:** `docs/lab3-engineering-contract`
- **Peer reviewer:** [Tanaboonnnnn](https://github.com/Tanaboonnnnn)
- **Current verdict:** Changes requested on `b8e0412`; Login failure contract remediation prepared locally and re-review pending

## Pull Requests I Authored

PR #43 remediation: [Chxtamos requested changes](https://github.com/L0u1sss/TokTickIT/pull/43#pullrequestreview-5249123058)
on reviewed head `8010379a2a2da35a4d0e4336515acd10f64ce738`: static MEDIUM default violates
initial IT Priority copying. Local changes remove the Prisma default, add a forward migration
to drop the database default, make fixture creation explicit, and verify LOW/MEDIUM/HIGH
API initialization plus direct-insert rejection and upgrade preservation. Full server
220/220 and Queue E2E 1/1 pass; see `tests.md`. Response commit, hosted CI for the
correction and peer re-review are pending; no approval is claimed.

| PR | Scope | Reviewer | Verdict / evidence |
|---|---|---|---|
| [#39](https://github.com/L0u1sss/TokTickIT/pull/39) | Issue #29 engineering contract and traceability | [Tanaboonnnnn](https://github.com/Tanaboonnnnn) | [Changes requested on `b8e0412`](https://github.com/L0u1sss/TokTickIT/pull/39#pullrequestreview-5210534997); local remediation awaits re-review |

## Pull Requests I Reviewed for My Partner

| Repository / PR | Review focus | Evidence |
|---|---|---|
| Not recorded yet | Add only reviews actually submitted during Lab 3 | Pending |

## Contract Review Checklist

- [ ] Sprint Goal, stakeholder request, included/excluded scope reviewed
- [ ] FR-01–FR-17 are observable and cover auth, Requester, IT Staff and Administrator
- [ ] BR-01–BR-39 resolve password, session, ownership, roles, workflow, comments/notes, login attempts and account safety
- [ ] Authorization matrix matches API and UI role behavior
- [ ] Status-transition matrix and confirmation rules are accepted
- [ ] Data model, migration, initial-password and idempotent seed decisions preserve Lab 2 data
- [ ] API paths, request/response shapes, query defaults, statuses and safe errors are unambiguous
- [ ] UI screen structure, modes, responsive and accessibility rules are testable
- [ ] Every AC-01–AC-19 maps to at least one planned test
- [ ] Planned tests include unit, DB/migration, API, security, regression, UI, responsive/accessibility and E2E
- [ ] Scope does not add excluded Lab 3 features or claim unrun evidence

## Review Comments and Responses

| Date | PR / commit | Reviewer comment | Author response / change | Resolution |
|---|---|---|---|---|
| 2026-09-15 | [PR #39 review on `0b970ac`](https://github.com/L0u1sss/TokTickIT/pull/39#pullrequestreview-5206192375) | Staff Attachment download route contradicted the capability matrix | Added dedicated staff route, authorization, UI behavior and API/UI/E2E test trace | Re-review pending |
| 2026-09-15 | [PR #39 review on `0b970ac`](https://github.com/L0u1sss/TokTickIT/pull/39#pullrequestreview-5206192375) | Assignment could race deactivate/demote and leave an ineligible owner | Added shared cross-operation lock/transaction invariant and explicit race tests | Re-review pending |
| 2026-09-15 | [PR #39 review on `0b970ac`](https://github.com/L0u1sss/TokTickIT/pull/39#pullrequestreview-5206192375) | Terminal ownership, resolution-indication statuses and Login Origin behavior were ambiguous | Split active `owner` from historical `lastOwner`, locked allowed statuses and required Origin check on Login | Re-review pending |

### PR #39 follow-up on `b8e0412`

- Review: [2026-09-15 re-review](https://github.com/L0u1sss/TokTickIT/pull/39#pullrequestreview-5210534997).
- Blocker: API distinguished inactive-account Login failures while API-02 expected indistinguishable errors.
- Local response: BR-02, AC-02, Login API/UI and API-02 now require the same `401 AUTHENTICATION_FAILED` and generic message for unknown email, wrong password and inactive accounts, including inactive accounts with valid credentials. No new session/authenticated session cookie or account-specific detail is returned. Validation, Origin, rate-limit and unexpected failures retain their separately defined errors.
- Non-blocking follow-up: PR description must report AC-01–AC-19 and 19/19 planned-test traceability. A replacement description is prepared locally; the hosted PR body has not been updated by this change.
- Development sidebar: explicit PR #39 ↔ Issue #29 linkage still needs verification in GitHub; `Closes #29` in a PR targeting `lab3-staging` is not recorded here as proof of that linkage.
- `lastOwnerId` remains an implementation commitment, together with the existing API/UI/test behavior.
- Status: local documentation remediation prepared; response commit, peer re-review and approval pending. No implementation test result is claimed.

## Implementation Review Log

### Issue #31 local implementation (not a peer review)

Branch `feat/lab3-user-migration` reuses authentication baseline `6d39f49`. Local migration/session/role/Requester regression results are in [tests.md Section 7](tests.md#7-current-local-verification--issue-31). Final response commit, hosted CI and actual peer verdict are pending. No reviewer or approval is inferred from local tests. Initial-password local-only decision and collision handling should be included in the next peer review; see [identity-migration.md](identity-migration.md).

เพิ่มหนึ่งแถวต่อ implementation PR หลัง review จริง โดยอ้าง exact PR, reviewed SHA, finding, response commit และ final verdict

| Issue / PR | Reviewed SHA | Focus | Findings / response | Verdict |
|---|---|---|---|---|
| Pending | Pending | Migration/authentication/authorization | Not reviewed | Pending |
| Pending | Pending | Staff queue | Not reviewed | Pending |
| Pending | Pending | Staff ticket operations/comments/notes | Not reviewed | Pending |
| Pending | Pending | Administrator User Management | Not reviewed | Pending |
| Pending | Pending | E2E/visual/release integration | Not reviewed | Pending |

## Final Sign-off

- Contract approved by: Pending
- Final `main` SHA: Pending
- Final hosted CI: Pending
- All review threads resolved: No — remediation awaits response commit and peer re-review
- Lab 3 final approval: Pending

## PR #45 review remediation

Review [5255696969](https://github.com/L0u1sss/TokTickIT/pull/45#pullrequestreview-5255696969) requested a shared explicit communication DTO, readable Requester status labels, resource lookup before body validation, and current CI evidence. The working-tree fixes add exact DTO assertions for all communication routes, enum-label regression tests, and missing/foreign resource precedence tests. Hosted CI for commit `1f83354e6c1acac5b86d9c0e85f65c6bf52d2d7b` passed in [run 35388712119](https://github.com/L0u1sss/TokTickIT/actions/runs/35388712119): server 269/269, client 96/96, Comments/Notes browser 1/1, Staff Queue browser 1/1, responsive 6/6, lint/build passed. This evidence applies to that commit only. Review-remediation changes need a new hosted run and peer re-review; approval remains pending.
