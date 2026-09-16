# Issue #30 — Authentication implementation and handoff

## Historical Issue #30 baseline

Integration update (2026-09-17): this branch includes reviewed #40 head `d3aa8c3` through `lab3-staging` merge `6163547` and #42 merge `10fa732`. The workflow instructions below were written while #40 was open; they are historical, not an instruction to retarget the now-dependent PR back to the authentication branch. #42 can remain based on `lab3-staging`. All browser paths now enter AuthApp; the historical `isAuthPath` split is no longer used by main.tsx. Issue #30 closure still requires the #31 cutover to be merged and verified.

> Current behavior has moved to Issue #31: see [identity migration and authorization](identity-migration.md). The staged `/account` flow and legacy-selector statements below describe only baseline `6d39f49`, not the current branch.

Issue [#30](https://github.com/L0u1sss/TokTickIT/issues/30) implements Login, current user, mandatory password change, Logout, an authentication guard and the auth screens/account shell. The approved contract is PR #39 at `03b5b718`; implementation started from merged `lab3-staging` commit `db281f2` on `feat/lab3-authentication`.

The current increment exposes `/login`, `/change-password` and `/account`. Successful Login routes to mandatory Change Password or the account shell with authenticated name/role and Logout. Direct `/account` access revalidates the server session; after Logout, it returns to Login.

The overlapping migration/activation work is retained in [#31](https://github.com/L0u1sss/TokTickIT/issues/31): migrating existing Requester identities, moving Ticket/Attachment foreign keys, using session identity for those APIs, removing the legacy selector endpoint/components, and activating role-specific Ticket/Staff/Admin routes. Existing Lab 2 routes still use Development Requester context in this intermediate branch. **This increment must not be described as securing the entire application or completing the Lab 3 requester cutover.** The new account shell does not expose unmigrated Ticket operations. The final app entry/navigation described in `ui-spec.md` remains a #31 integration requirement.

## Storage and credentials

- Additive migration `20260916000000_authentication_foundation` creates `UserRole`, `User` and `Session` with indexes/FK and a canonical-email check. Historical migrations, RequesterUser rows, Tickets and Attachments are unchanged.
- User credentials use Argon2id with a random salt, 19,456 KiB memory, two iterations and parallelism one. Tokens contain 32 cryptographically random bytes; only SHA-256 token hashes are stored.
- Session lifetime is eight hours, with `HttpOnly`, `SameSite=Lax`, `Path=/`, and `Secure` outside explicitly configured `development`/`test` environments.
- `auth:provision` is an explicit local-lab command. It creates a new fixture account, prints its random initial password once, and sets `mustChangePassword=true`. A rerun does not reset credentials, role or activation. Existing Requester emails are rejected; their migration belongs to #31.
- Fixture IDs are allocated above current User/RequesterUser IDs. #31 must still check ID/email collisions and preserve existing Requester ownership before changing foreign keys; creating unrelated new Requesters during this intermediate phase does not establish an auth identity mapping.

## Observable authentication behavior

- Unknown email, wrong password and inactive accounts (including correct passwords) all return `401 AUTHENTICATION_FAILED` with `Unable to sign in with the provided credentials.` and no authenticated cookie/session. Unknown emails still perform a dummy Argon2id verification.
- Unsafe auth requests require exact `CLIENT_ORIGIN` before JSON/credential validation. JSON body limit is 16 KiB; invalid/unknown fields receive safe validation errors.
- Login counts only failed credential checks per IP + normalized email in a fifteen-minute fixed window. After ten failures, further requests return `429 TOO_MANY_ATTEMPTS` and `Retry-After` until expiry. Successful logins neither consume nor reset the failure budget; malformed requests and server failures do not consume it. Concurrent checks already in flight may finish before the threshold is observed. The in-process map expires old buckets and caps active buckets at 10,000. It resets when the process restarts and is suitable only for this single-process local lab.

## PR #40 review follow-up: completion and dependency boundary

Issue #30 is **partial**, not complete: PR #40 delivers the authentication foundation, but does not yet replace the Development Requester selector on Ticket routes. The original Lab 3 requirement remains mandatory; this staged handoff does not waive or redefine it. Selector removal, authenticated Ticket ownership and role routing require Issue #31 / PR #42 integration and verification before #30 can close.

- FR-01 authentication: implemented at the auth entry points; selector replacement remains pending integration.
- FR-04 / UI-03: account identity exists; final role navigation and Ticket-route authorization remain pending #31.
- Trailing-slash aliases of `/login`, `/change-password`, `/account` stay inside AuthApp.
- Standalone authentication guards and auth-router errors share safe `requestId` / optional `fieldErrors` envelopes, including synchronous database failures.

### GitHub actions still required by the owner (not performed locally)

1. Update Issue #30 and PR #40 description to state the partial foundation/cutover dependency above. Use `Refs #30`, not `Closes #30`, until the original replacement requirement is verified.
2. While #40 is open, set PR #42 base to `feat/lab3-authentication` (head `feat/lab3-user-migration`), or mark #42 Draft and do not request final approval. PR #40 remains based on `lab3-staging`.
3. Incorporate this follow-up into #42, rerun CI, and review the new head. Old CI only proves its recorded SHA, not these uncommitted changes.
4. After #40 merges, sync #42 with `lab3-staging`, retarget its base back to `lab3-staging`, and rerun CI before final review.
- New passwords require 12–128 Unicode code points, no leading/trailing whitespace and at least three character classes. Confirmation and current password are checked; reuse is rejected.
- Change Password rechecks live session/user state inside a transaction with a User row lock, rotates the current token and deletes all prior sessions. Login shares the lock and rechecks the password hash to prevent stale-credential session creation.
- The reusable guard rejects missing/expired/revoked/inactive sessions and forced-change users. It is tested on a protected test route; mounting it across the legacy Ticket/Attachment routes is #31 work.
- Logout deletes the presented session and clears the cookie, including repeated/missing-session calls. UI hides account content immediately and retains a Retry logout state on network failure. Auth responses use `Cache-Control: no-store`.
- UI includes busy states, password visibility controls, required markers, blur/submit validation, focusable error summary and links to fields. Password input has no native UTF-16 `maxLength`; validation counts code points. Password fields clear after a submission; email remains available for retry.

## Historical #30 setup (use the linked #31 instructions on the current branch)

From `server`, configure `DATABASE_URL`, `TEST_DATABASE_URL`, `CLIENT_ORIGIN=http://localhost:5173` and `NODE_ENV=development` in `.env`. The browser origin must match exactly (including hostname and port).

```powershell
cd D:\Software_Engineering\toktickit\server
npm.cmd ci
npx.cmd prisma generate
npx.cmd prisma migrate deploy
npm.cmd run auth:provision -- --email auth-demo@example.test --name "Local Auth Demo" --role REQUESTER
npm.cmd run dev
```

Keep the generated initial password private. Do not paste terminal credential output into commits, screenshots or review evidence. Use a separate email from the existing Development Requester fixtures. Existing accounts are never reset by this command.

In another terminal:

```powershell
cd D:\Software_Engineering\toktickit\client
npm.cmd ci
npm.cmd run dev
```

Open `http://localhost:5173/login`, use the newly generated credential, change the password, inspect the authenticated account shell, then Logout. `/` and existing Ticket paths remain the Lab 2 entry until #31.

## Verification commands

From the repository root:

```powershell
npm.cmd --prefix server test
npm.cmd --prefix client test
npm.cmd --prefix server run lint
npm.cmd --prefix client run lint
npm.cmd --prefix server run build
npm.cmd --prefix client run build
npm.cmd --prefix client run test:auth:e2e
git diff --check
```

The auth database test and browser runner create random disposable schemas inside the explicit test-marked `TEST_DATABASE_URL`, deploy all four migrations, and drop only their own schemas afterwards. They do not migrate/reset the development database. Browser fixture credentials are generated per run. Tests verify the migration/schema diff is empty as well as authentication behavior.

CI now also triggers on `lab3-staging` and runs the auth browser command. Local verification does not imply a hosted CI run or peer approval; actual results and outstanding full-contract IDs are tracked in [tests.md](./tests.md).
