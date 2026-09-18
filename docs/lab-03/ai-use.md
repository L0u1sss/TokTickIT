# Lab 3 — AI Use and Reflection

## PR #43 review remediation — 2026-09-18

User asked Codex to fix review 5249123058 against the Lab 3 handout. The reviewer
identified the misleading static MEDIUM default despite correct API initialization.
New integration checks reproduced the database behavior before remediation. The fix
removes the Prisma default and adds a forward DROP DEFAULT migration, preserving old
migration checksums and staff-adjusted priorities. Direct Ticket fixtures now initialize
priority explicitly and simulate subsequent staff changes with updates. Verification
covers LOW/MEDIUM/HIGH creation/replay, missing-priority SQL rejection, metadata and
populated upgrade preservation. Full server 220/220, Queue E2E 1/1, server build/lint
and Prisma validate passed locally. No GitHub message, push or approval was performed.

## Issue #32 — 2026-09-18

Codex (GPT-6) implemented the IT Staff Ticket Queue from the user's linked issue,
the Lab 3 handout text and the repository API/UI specification. The pre-implementation
test plan is recorded in `staff-queue-implementation.md`. Work includes an additive
data migration, strict queue API, active assignees, responsive UI, read-only detail
integration and automated tests. No additional agents were used.

Verification exposed the legacy NEW-only database constraint, migration fixtures
that assumed the newest migration was always identity cutover, a narrow desktop
card and ambiguous browser label lookup. These were corrected, with passing
results recorded in `tests.md`. Existing Lab 2 checks were updated only where the
Lab 3 schema deliberately extends the earlier contract. No peer review, remote
push, merge or hosted CI result is claimed.

## Integration follow-up — 2026-09-17

CI diagnosis follow-up: AI read job `104945197026` from run `35140205383`. The responsive step timed out waiting for Create Ticket after direct entry at `/tickets/new`. No new runtime change was required beyond the uncommitted unconditional AuthApp entry fix; rerunning `npm --prefix client run test:responsive` passed 5/5. Assertions/timeouts were not weakened, and no remote rerun or push was performed.

User requested that local `feat/lab3-user-migration` continue from PR #40 after resolving conflicts on GitHub. AI fetched origin, confirmed local merge `10fa732` already includes `d3aa8c3` via `6163547`, and found that the web resolution reintroduced the legacy conditional app entry point. AI restored unconditional AuthApp routing, expanded real-browser direct-entry/reload coverage, and updated the handoff/API/evidence wording. Local verification: server 188/188, client 80/80, auth browser 1/1, live E2E 6/6, both lint/build passed. No commit, push or remote PR update was performed. Human review and hosted CI on the next pushed SHA remain required.

- **Developer:** [L0u1sss](https://github.com/L0u1sss)
- **LLM/agent used:** OpenAI Codex
- **Current scope:** Lab 3 engineering contract and Issue #30 authentication foundation
- **Disclosure status:** Includes contract Issue [#29](https://github.com/L0u1sss/TokTickIT/issues/29) and local authentication implementation [#30](https://github.com/L0u1sss/TokTickIT/issues/30); actual local test results are recorded in `tests.md`, not claimed as hosted CI or peer approval

## Selected Key Prompts

ข้อความด้านล่างสรุปจาก prompts ที่ใช้จริงในบทสนทนา โดยรักษาเจตนาเดิมและไม่ claim งานที่ยังไม่เกิดขึ้น

| # | Prompt (summarised) | AI contribution | My verification / decision |
|---:|---|---|---|
| 1 | Read `Lab_3_sheet.pdf` and propose Lab 3 issues and descriptions | Extracted required roles, features, evidence and possible decomposition | Checked numbering against this repository and corrected the starting issue sequence |
| 2 | Look only at open GitHub issues and provide branch names | Mapped issue scopes to branch naming suggestions | Kept one feature branch per bounded issue and a separate `lab3-staging` integration branch |
| 3 | Map IT Staff queue and ticket-operations issues to branch names | Distinguished `feat/lab3-staff-ticket-queue` from `feat/lab3-staff-ticket-operations` | Confirmed queue and operational detail are separate deliverables |
| 4 | Decide whether user migration and role authorization should be combined | Compared coupling and review trade-offs | Kept contracts distinct but allowed implementation sequencing based on migration dependency |
| 5 | Create clean Lab 3 Markdown documents from the Lab 2 documentation set | Created the required Lab 3 document structure without copying Lab 2 completion claims | Reviewed files to ensure Lab 2 SHAs, test counts and reviewer verdicts were removed |
| 6 | Add a Lab 3 section to README based on the labsheet | Summarised roles, required repository increment, branch flow and submission headings | Checked that README describes requirements, not fabricated implementation evidence |
| 7 | Write the Issue #29 title/description and branch scope | Produced a docs-only engineering-contract issue definition | Confirmed exact issue body from GitHub and used branch `docs/lab3-engineering-contract` |
| 8 | Implement Issue #29 using the Lab 3 reference | Drafted numbered FR/BR/AC, matrices, migration, API/UI contracts and pre-implementation tests | Chose session/password/workflow decisions, removed ambiguous TBDs and kept every test status Planned |
| 9 | Apply the review comments from PR #39 | Identified cross-file contradictions and proposed atomic ownership, historical-owner, status and Origin rules | Verified the review against the contract, chose a dedicated staff download route and added explicit planned race/security tests |
| 10 | Fix the PR #39 re-review on `b8e0412` locally | Aligned BR/AC/API/UI/test planning on generic Login failures, updated the review record and drafted a PR description with 19/19 AC traceability | Local contract decision: unknown email, wrong password and inactive account share `401 AUTHENTICATION_FAILED`; implementation tests remain Planned and peer re-review is pending |

## Important Decisions I Retained or Changed

- Issue #30 prompt: implement authentication using the approved Lab 3 contract, then continue. Codex added User/Session storage, Argon2id, auth endpoints, session/password-change rules, auth UI, isolated API/browser tests and setup instructions. Local validation was performed with tests and lint/build commands; it is not peer approval.
- Historical #30 decision: the implementation explicitly stages User/Session and the `/login` → `/change-password` → `/account` flow in #30. Existing Requester data migration, legacy transport removal and Ticket-route activation remain in #31. The full Lab 3 cutover is not claimed complete.
- Corrected a UI test timeout by supplying the long Unicode boundary value as one input change, and fixed Logout failure handling so the Retry action survives account-shell unmounting.

- Retained the labsheet requirement to replace the Development Requester selector with authenticated identity.
- Chose an opaque database-backed HttpOnly session cookie and Argon2id rather than asking the AI to leave auth decisions unspecified.
- Explicitly permitted Administrator Ticket operations in the approved matrix to satisfy owner/IT Priority rules, while keeping User Management exclusive to Administrator.
- Defined exact status transitions, queue defaults, password/content limits and error behavior so implementation tests have observable boundaries.
- Required migration tests on both an empty database and populated Lab 2 data before removing the old requester model.
- Rejected any suggestion to mark tests, CI, screenshots, reviews or approvals as complete before evidence exists.
- Separated active `ownerId` from terminal `lastOwnerId`, required one transaction/lock protocol across assignment and account eligibility changes, and required Login Origin validation because Login creates the session cookie.

## My Reflection

The latest review exposed a mismatch between a distinguishable inactive-account API response and the planned indistinguishable-error test. The local remediation chooses one observable status/code/message across all account-specific Login failures and carries it through BR-02, AC-02, API, UI and API-02. This is a contract decision; runtime behavior and passing authentication tests must be evidenced by the later implementation issue.

AI ช่วยลดเวลาการแตก labsheet ที่ยาวให้เป็น requirement IDs, authorization/status matrices และ test traceability ได้มาก โดยเฉพาะการมองหาจุดที่มักกำกวม เช่น identity source, safe `404`, concurrent claim และ last-active-admin protection อย่างไรก็ตาม output แรกยังเป็นเพียง template และมี `TBD` มากเกินไป จึงต้องตรวจกลับกับ labsheet และ contract ของ Lab 2 แล้วตัดสินใจรายละเอียดเองก่อนใช้เป็นฐาน implementation

สิ่งสำคัญที่ได้เรียนรู้คือ “เอกสารครบ” ไม่ใช่แค่มีชื่อหัวข้อ แต่ทุก requirement ต้องมี behavior ที่สังเกตได้ มี API/UI ที่สอดคล้อง และ trace ไป test ได้ อีกทั้งต้องแยก planned evidence ออกจาก passed evidence อย่างเคร่งครัด เพื่อไม่ให้ PR description หรือรายงานอ้างผลที่ยังไม่ได้รัน

## Evidence Maintenance Rule

### PR #40 review remediation — 2026-09-17

Prompt: fix review `5226584204` locally. AI normalized auth entry-point trailing slashes, changed the limiter to count credential failures only, shared the safe error response between router and reusable guard, and added regression tests. AI also documented the unresolved Issue #30 selector-cutover dependency and stacked PR #42 workflow without changing GitHub, switching branches, committing, or pushing. Local results: server 226/226, client 96/96, auth browser 1/1; see tests.md for scope. Human review must confirm the issue-boundary wording, perform the remote base/description updates and rerun hosted CI after integration. No peer approval or new hosted result is claimed.

หลังแต่ละ implementation PR ให้เพิ่มเฉพาะ prompt ที่มีผลต่อ design/code/test อย่างมีนัยสำคัญ พร้อมบันทึกสิ่งที่ผู้พัฒนาตรวจสอบหรือแก้เอง Final submission เลือก 6–10 prompts ที่เป็นตัวแทน ไม่จำเป็นต้องคัดลอก transcript ทั้งหมด และต้อง sync exact final SHA/CI กับ [tests.md](./tests.md) และ [reviewer.md](./reviewer.md)

## Issue #31 implementation disclosure

User request: implement Issue #31 using the Lab 3 reference. AI read the issue and existing contract, reused local authentication commit `6d39f49`, and implemented transactional Requester migration, session-only Ticket/Attachment identity, role guards, selector removal, account navigation and test/README updates. No remote push or approval was performed.

Verification used isolated PostgreSQL schemas, populated migration/collision cases, real-cookie ownership tests, preserved Ticket/Attachment component regressions and live browser flows. Tests detected the Prisma RESTRICT error shape, retired-selector expectations and a mobile Logout touch target; these were corrected rather than marking failed tests passed. Screenshots now go to Lab 3 evidence so historical Lab 2 screenshots are not overwritten. Test counts changed because obsolete selector tests were replaced, not because all Lab 3 requirements are finished.

Team decision requiring review: migrated local-lab users receive the documented shared initial fixture password and forced change, not production password delivery. ID/email collisions fail instead of merging accounts. Workflow/staff/admin operations remain out of #31 scope; see `identity-migration.md` and `tests.md` for exact evidence.

Final contract comparison caught the Lab 2 foreign-owner `403` versus Lab 3 non-disclosing `404 NOT_FOUND` difference. The implementation and regression expectations were updated together. Error correlation IDs, direct My Tickets query preservation and explicit Forbidden screens for Requester access to Staff/Admin routes were also verified. A flaky redirect assertion was changed to wait for the asynchronous route effect, not to relax the expected destination.

## Issue #34 implementation (2026-09-19)

User requested implementation of issue #34 in the local TokTickIT workspace using Lab_3_sheet.pdf. Codex read the issue, existing engineering contract and handout, completed Requester comments/resolution indication, tightened Staff communication validation, separated Internal Notes loading, and added API/UI/live-browser coverage. It checked disposable-schema migrations, Unicode limits, forged metadata, role isolation, plain-text rendering and responsive screenshots. Human peer review and integration remain pending. See [local evidence](comments-notes-implementation.md).
