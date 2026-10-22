# ROOF/OS first five release-gap design

## Intent

Make the next five highest-value release gaps smaller, testable, and usable with free/open-source tooling. This batch must stop after five items, pass verification, update `main`, and leave the remaining device/provider work explicitly queued for the next batch.

## Priorities

### 1. Restore normal Supabase authentication

**Problem:** The live login page currently exposes only the owner break-glass unlock. The repository also contains signup and callback flows, but ordinary users cannot reach password or magic-link sign-in from `/auth/login`.

**Fix:** Restore email/password sign-in, magic-link request, password-reset navigation, signup navigation, and retain break-glass as a clearly labeled owner-only fallback. Use the existing Supabase browser client; add no paid service.

**Acceptance:** The login page contains working controls for password sign-in and magic-link request, links to signup/reset, keeps safe `next` handling, and has a regression test covering the controls and the break-glass boundary. No secret is moved to the browser.

### 2. Make migration 053 verifiable before deployment

**Problem:** Migration 053 exists in source and CI checks migration presence, but CI does not assert its approval hash binding, pgcrypto dependency, or fail-closed RPC privileges.

**Fix:** Extend the free GitHub Actions migration-safety gate and a local deterministic migration contract test to assert the migration's tables, RLS, hash recomputation, atomic approval transition, function search path, revoke/grant boundary, and next-prefix ordering.

**Acceptance:** A malformed or weakened migration fails the local test and CI; the current migration passes. This verifies source safety but does not claim that production has applied the migration.

### 3. Add an authenticated two-workspace RLS and private-Storage smoke harness

**Problem:** Cross-workspace isolation is documented but not executable from this repository with synthetic accounts.

**Fix:** Add a Node script using the existing Supabase JS client and anonymous publishable key. It accepts test-user credentials only through environment variables, signs in two users, resolves each workspace, attempts positive reads/writes in each workspace, attempts negative cross-workspace reads/writes, and checks that a private inspection-photo object cannot be read across workspaces. It must refuse to run if required variables are absent and must never print credentials or real payloads.

**Acceptance:** The script has a dry configuration check, a clear synthetic-data contract, explicit cleanup/idempotency keys, bounded selects, and nonzero exit on any cross-workspace visibility or mutation. It is opt-in and not run against production automatically.

### 4. Add free backup/restore operational automation

**Problem:** The owner manual describes backups but there is no repeatable repository workflow for a database export, migration snapshot, or restore rehearsal.

**Fix:** Add a manually triggered GitHub Actions workflow using the Supabase CLI container/action and encrypted repository secrets. It exports schema/data metadata to a short-retention artifact, excludes secrets, prints only counts/checksums, and has a separate dry-run restore validation against a disposable staging project URL. Document required secrets, retention, and the fact that a source ZIP is not a data backup.

**Acceptance:** Workflow YAML passes static checks, is manual-only, has least-privilege permissions, uses no hardcoded credentials, and the owner manual explains how to run and verify it. The workflow must not touch production by default.

### 5. Reconcile current release truth

**Problem:** Historical documents still contain stale current-main SHAs, old PR states, and wording that can be mistaken for current evidence.

**Fix:** Add a dated current checkpoint to the owner-facing README, handoff, operating cadence, and release-status documents. Keep historical entries intact, but clearly mark the new baseline, merged PR, passing CI, unverified production migration, and remaining device/provider gates.

**Acceptance:** A fresh reader can identify the current main commit, what passed, what is not verified, and the next batch without searching historical sections. No historical evidence is deleted or rewritten as if it never existed.

## Non-goals for this batch

- Applying migrations to production.
- Using real customer data.
- Enabling production cron or external side effects.
- Claiming a physical Android/iOS test from source or CI.
- Adding paid AI, claims, telephony, pricing, or payment providers.
- Replacing Supabase RLS with application-only authorization.

## Free-tool choices

- GitHub repository and GitHub Actions.
- Supabase Auth, Postgres RLS, Storage, and the existing publishable client.
- Supabase CLI for manual workflow execution.
- Node.js scripts and existing npm test infrastructure.
- No new paid dependency or hosted AI service.

## Verification contract

Before implementation: verify the current clean `main` baseline and inspect the existing auth, migration, test, CI, and operational files.

After implementation: run focused red/green regression tests, typecheck, production build, security/release checks, migration-safety checks, the full existing CI-equivalent suite, and `git diff --check`. Run the RLS harness only when synthetic test credentials and a non-production project are explicitly configured. Stop after these ten items, commit, open a PR, wait for required checks, merge to `main`, and verify the post-merge workflow.

## Batch-size update: five additional bounded fixes

The owner expanded this batch from five to ten. Items 6–10 remain source-level, free-tool fixes and must not be represented as proof of a real-device or provider-side production run.

### 6. Make the mobile release gate explicit

Add the missing migration-053/field-version checks to the mobile release contract, make the EAS workflow fail clearly when `EXPO_TOKEN` is absent, and update the field release document to distinguish CI bundle evidence from physical-device evidence.

### 7. Make invitations truthful and testable

Add a deterministic invitation-flow contract covering admin authorization, token acceptance, expiry, replay rejection, membership creation, and the fact that email delivery remains provider-dependent. Do not invent delivery success or send real invitations.

### 8. Add worker heartbeat and cron observability

Add a free, durable worker-run status contract for the approved internal action worker and existing scheduled workers: start, success/failure, last error, and last successful completion. The status endpoint must report stale or missing heartbeats without claiming the worker is healthy.

### 9. Harden production configuration truth

Make `/api/status` and release checks flag unsafe production configuration such as localhost model endpoints, missing required public Supabase variables, or enabled cron without its secret. Keep optional free-core providers clearly disabled rather than silently pretending they are available.

### 10. Close low-cost database security gaps in source

Add migration-safety checks for SECURITY DEFINER functions to require an explicit search path and least-privilege grants, add only justified indexes for the verified workspace/action access paths, and document Supabase dashboard-only controls such as leaked-password protection as external gates rather than claiming source can change them.

## Safe defaults from builder review

- Backup automation is staging-only and manual; it does not export production data by default.
- No database dump containing customer data is uploaded unencrypted to GitHub artifacts. If a future owner-approved backup requires artifacts, encryption and key custody must be specified first.
- Restore rehearsal is syntax/schema validation unless an explicitly named disposable staging project and protected GitHub Environment are configured.
- The RLS harness requires dedicated synthetic users and a non-production project URL supplied through environment variables; it never guesses production safety and never prints credentials.
- Current-main documentation records the pre-merge baseline in the PR and the post-merge SHA only in a subsequent verified checkpoint; historical entries remain unchanged.
