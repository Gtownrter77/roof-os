# Next Ten Release-Evidence Implementation Plan

**Goal:** Close ten bounded release-evidence and recovery gaps on top of `main` `b6520da825cb31cf538894fbfc44c87a38a752c3`, while recording—but not implementing—the ranked feature shortlist.

**Constraints:** No production SQL, customer data, provider side effects, or paid dependency. Staging workflow is manual, protected, allowlisted, and fail-closed. Local field evidence is retained on sign-out. CI/source checks are never described as authenticated live evidence.

## Task 1 — Current documentation checkpoint

Update `AUDIT-STATUS-2026-10-21.md`, `HANDOFF.md`, `STATE-OF-THE-UNION.md`, and deployment/current-state documents with the merged SHA, PR #288, passing post-merge run, and remaining external gates. Preserve historical checkpoints.

Add a static documentation-currentness contract where it can be deterministic without rewriting history.

## Task 2 — Migration guide reconciliation

Update `MIGRATION-ORDER.md`, `DEPLOYMENT.md`, and `SUPABASE-MANUAL-MIGRATION.md` for migration 053, next prefix 054, staging-first procedure, and explicit production-unverified state. Add a read-only SQL verification snippet that returns migration ledger/schema evidence without exposing secrets.

## Task 3 — Protected staging migration workflow

Create `.github/workflows/staging-migration-verify.yml`. Require manual dispatch, the `staging-migration` protected environment, `STAGING_DB_URL`, `STAGING_PROJECT_REF`, and an explicit confirmation input. Validate the target project reference and refuse production-like URLs. Run Supabase CLI migration status/diff/checksum commands only; never upload dumps or mutate production.

## Task 4 — Invitation unauthenticated redirect

Modify `app/team/invitations/accept/page.tsx` and auth callback handling to route a 401 through `/auth/login` with `safeNextPath`-compatible invitation parameters. Add a contract test for preserving `invitationId` and rejecting external next paths.

## Task 5 — Invitation UI idempotency and states

Add a one-request guard, explicit accepted/already-accepted/expired/error states, and a safe return/sign-in action. Do not claim membership until the POST returns success. Extend invitation-flow regression coverage.

## Task 6 — Mobile sign-out hygiene

Modify `apps/field/App.tsx` to add a visible sign-out control. Call Supabase sign-out, clear session-bound React state, remove cached email/technician identity if appropriate, retain owner-scoped local drafts, and prevent stale draft display after logout. Add a static mobile contract test.

## Task 7 — Mobile retry-now

Add a retry-now handler that updates only the selected draft’s queued/retrying rows, clears their next retry time, refreshes queue state, and calls `syncNow`. Preserve client IDs, error text, and idempotent upserts. Add regression assertions.

## Task 8 — Mobile session-expiry classification

Add a narrowly scoped auth-error classifier. On expired/invalid session errors, stop escalating retries, preserve local rows, sign out, and show re-authentication guidance. Network, RLS, workspace mismatch, and file errors remain retryable/visible. Add unit/contract coverage for representative Supabase errors.

## Task 9 — Worker heartbeat wiring

Add a shared helper or wrapper for cron heartbeat start/success/failure transitions and apply it to the internal cron routes with known workspace context. Extend status and worker tests to require truthful unknown/degraded states when no heartbeat exists.

## Task 10 — Release-evidence contract and checklist

Create a CI-safe `release-evidence-contract-test.mjs` and update the owner manual with a table separating source/CI, staging, authenticated browser, provider, and physical-device evidence. Include the feature shortlist link/section and the ten remaining external gates.

## Verification sequence

Run focused auth, invitation, mobile, worker, migration, documentation, and release-evidence tests. Run `npm run typecheck`, `npm run build`, `npm run audit`, `npm run verify:security`, `npm run release-check`, all existing CI-equivalent tests, workflow YAML parsing, mobile TypeScript checks, and `git diff --check`. Review the diff, commit, push, open a PR, wait for every required check, merge only when green, and verify post-merge main CI. Stop after task 10.
