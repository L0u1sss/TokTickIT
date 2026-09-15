# Lab 3 — Peer Review Record

> เอกสารนี้เก็บหลักฐาน review จริง ห้ามใส่ approval หรือ reviewer ที่ยังไม่เกิดขึ้น

- **Author:** [L0u1sss](https://github.com/L0u1sss)
- **Contract issue:** [#29](https://github.com/L0u1sss/TokTickIT/issues/29)
- **Branch:** `docs/lab3-engineering-contract`
- **Peer reviewer:** [Tanaboonnnnn](https://github.com/Tanaboonnnnn)
- **Current verdict:** Changes requested on `0b970ac`; remediation prepared locally and re-review pending

## Pull Requests I Authored

| PR | Scope | Reviewer | Verdict / evidence |
|---|---|---|---|
| [#39](https://github.com/L0u1sss/TokTickIT/pull/39) | Issue #29 engineering contract and traceability | [Tanaboonnnnn](https://github.com/Tanaboonnnnn) | [Changes requested on `0b970ac`](https://github.com/L0u1sss/TokTickIT/pull/39#pullrequestreview-5206192375) |

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

## Implementation Review Log

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
