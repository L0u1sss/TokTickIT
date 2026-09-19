# TokTickIT Lab 3 Release Dossier

เอกสารนี้เป็นต้นฉบับสำหรับ PDF submission ของ Issue [#38](https://github.com/L0u1sss/TokTickIT/issues/38) และอ้างอิงเอกสารประกอบการสอน `Lab_3_sheet.pdf` โดยแยกหลักฐานที่ตรวจแล้วออกจากหลักฐานที่ยังรอ final `main` หรือ peer approval อย่างชัดเจน

## Release Snapshot

| Item | Current evidence | Status |
|---|---|---|
| Release branch | `chore/lab3-release-preparation` at `96eee028` | In progress |
| Lab 3 staging baseline | `lab3-staging` at `c824790` | Available |
| Implemented slices | Auth, requester regression, staff queue, comments/notes, user management | Available on release branch |
| Browser evidence | Requester, staff queue, comments/notes and administrator screenshots | Available in `artifacts/lab-03/` and `docs/lab-03/evidence/` |
| Final `main` SHA | Not established | Blocked |
| Final hosted CI | Not established for final `main` | Blocked |
| Peer approval / resolved review threads | Pending in [reviewer.md](./reviewer.md) | Blocked |
| Submission PDF | Not generated yet | Blocked |

## Answer Part 1: Git Use with Engineering Workflow

The release branch was created after the Lab 3 feature branches were integrated. The current local ancestry includes the requester regression merge (`#36`), the Lab 3 staging merge (`#37`), and the preceding staff/admin/comment implementation merges. The branch and commit graph must be rechecked after the final merge to `main`.

- Branch flow evidence: `lab3-staging` -> `chore/lab3-release-preparation` -> `main` (final merge still pending).
- Issue evidence: [Issue #38](https://github.com/L0u1sss/TokTickIT/issues/38) and the linked Lab 3 implementation issues.
- Review record: [reviewer.md](./reviewer.md).
- Repository guidance: [README.md](../../README.md) and [`.gitignore`](../../.gitignore).
- Structure reviewed: `client/`, `server/`, `docs/lab-03/`, `artifacts/lab-03/`, `.github/workflows/`.

**Release gate:** do not mark this part complete until the final `main` SHA, merge path, GitHub Kanban state, and hosted CI URL are recorded here.

## Answer Part 2: Spec DD

The normative contract is [specification.md](./specification.md). It contains FR-01–FR-17, BR-01–BR-39, the authorization matrix, status-transition matrix, data/migration decisions, and AC-01–AC-19. Supporting contracts are [api-spec.md](./api-spec.md) and [ui-spec.md](./ui-spec.md).

The release audit must verify every requirement against an implementation path and a test/evidence path. Requirements that are still marked `Planned` in [tests.md](./tests.md) remain release blockers unless the contract is explicitly rescoped and reviewed.

## Answer Part 3: Test DD and Traceability

The test plan and AC traceability are maintained in [tests.md](./tests.md). Current documented evidence includes:

- Server isolated regression, API/security, migration and workflow tests for the implemented slices.
- Client component regression, lint and production build evidence.
- Live browser evidence for requester regression, staff queue and administrator user management.
- Responsive screenshots for desktop, tablet, mobile and the administrator reflow viewport.

Local verification was rerun on release-branch commit `96eee028`:

| Check | Result |
|---|---|
| `npm --prefix server test -- --run tests/lab-03` | 11 files, 156 tests passed |
| Focused client Lab 3 tests | 5 files, 26 tests passed |
| `npm --prefix server run lint` and `npm --prefix server run build` | Passed |
| `npm --prefix client run lint` and `npm --prefix client run build` | Passed |
| `npm --prefix client run lint` and `npm --prefix client run build` | Passed |

These are local release-branch results, not final-`main` or hosted-CI evidence. The final PDF must replace or supplement them with the exact final `main` SHA, CI run URL and result.

## Answer Part 4: AI Use with Reflection

See [ai-use.md](./ai-use.md). Before submission, confirm that it identifies the tools/models used, selected prompts (6–10), human review decisions, rejected suggestions, and a reflection on verification and limitations. Do not claim generated code was accepted without test or review evidence.

## Answer Part 5: Working Login and Password Change UI

Implementation and evidence references:

- [authentication-implementation.md](./authentication-implementation.md)
- [authentication E2E](../../client/e2e/lab-03/authentication.spec.ts)
- [auth API tests](../../server/tests/lab-03/auth.api.test.ts)

The final evidence must show valid login, generic invalid/inactive failure, busy state, mandatory password change, user/role display, reload/session continuity, and logout.

## Answer Part 6: Working IT Staff Ticket Queue UI

Implementation and evidence references:

- [staff-queue-implementation.md](./staff-queue-implementation.md)
- [staff queue E2E](../../client/e2e/lab-03/staff-queue.spec.ts)
- [staff queue API tests](../../server/tests/lab-03/staff-queue.api.test.ts)
- Screenshots: [staff queue evidence](../../artifacts/lab-03/screenshots/staff-queue/)

The final evidence must cover queue data, search, status/requested-priority/IT-priority/owner filters, sorting, pagination, detail navigation, empty/no-results/error states, and table-to-card responsive behavior.

## Answer Part 7: Working IT Staff Ticket Detail UI

Implementation and evidence references:

- [comments-notes-implementation.md](./comments-notes-implementation.md)
- [comments/notes API tests](../../server/tests/lab-03/comments-notes.api.test.ts)
- [staff ticket communication tests](../../client/tests/lab-03/TicketCommunication.test.tsx)
- [comments/notes E2E](../../client/e2e/lab-03/comments-notes.spec.ts)
- Screenshots: [comments and notes evidence](../../artifacts/lab-03/screenshots/comments-notes/)

The final evidence must demonstrate the complete operational contract: claim/reassign, IT Priority, valid/invalid status transitions, Public Comments, private Internal Notes, attachment continuity, requester resolution indication, role restrictions, conflict feedback and safe failures. Any still-planned detail tests are release blockers.

## Answer Part 8: Working Administrator User Management UI

Implementation and evidence references:

- [user-management.md](./user-management.md)
- [administrator E2E](../../client/e2e/lab-03/user-administration.spec.ts)
- [administrator API tests](../../server/tests/lab-03/users-admin.api.test.ts)
- Screenshots: [user management evidence](../../artifacts/lab-03/screenshots/user-management/)

The final evidence must cover list/search/role filter, create/edit, one-role assignment, activate/deactivate, initial-password reset, duplicate email validation, self-deactivation protection, last-active-admin protection, keyboard modal behavior and responsive reflow.

## Answer Part 9: Zen Green UI and Responsive Evidence

The visual contract is [ui-spec.md](./ui-spec.md). Current screenshot inventories are:

- Requester regression: [docs/lab-03/evidence/requester-regression](./evidence/requester-regression/)
- Staff queue: [artifacts/lab-03/screenshots/staff-queue](../../artifacts/lab-03/screenshots/staff-queue/)
- Comments/notes: [artifacts/lab-03/screenshots/comments-notes](../../artifacts/lab-03/screenshots/comments-notes/)
- User management: [artifacts/lab-03/screenshots/user-management](../../artifacts/lab-03/screenshots/user-management/)

The final visual checklist must record desktop/tablet/mobile coverage, role navigation, status/priority badges, editable versus read-only fields, visible focus, clipping, horizontal overflow, safe feedback and readable screenshot scale.

## Submission Checklist

- [ ] Audit every FR/BR/AC against implementation, test and evidence paths.
- [ ] Verify Definition of Done and update [tests.md](./tests.md) from `Planned` to evidence-backed results.
- [ ] Record final `main` SHA and branch-flow evidence.
- [ ] Record final hosted CI run and exact command results.
- [ ] Record actual peer approval and resolved review threads in [reviewer.md](./reviewer.md).
- [ ] Verify README, `.gitignore`, repository structure and GitHub Issues/Kanban state.
- [ ] Verify screenshots for every major screen at required viewports.
- [ ] Generate exactly one PDF using the nine exact headings in this document.
- [ ] Validate every PDF link from the exported file and attach only that PDF for submission.
