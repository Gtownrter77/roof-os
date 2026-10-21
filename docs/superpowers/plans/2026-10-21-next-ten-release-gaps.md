# Next Ten Release Gaps Implementation Plan

> **For agentic workers:** Use this plan task-by-task. Each task ends with its own verification.

**Goal:** Reduce the ten highest-value source and operational evidence gaps using free Supabase, GitHub, Node, and Expo tooling without claiming unperformed production or device tests.

**Architecture:** Keep Supabase Auth/RLS/Storage as the authority. Add deterministic repository contracts and opt-in live smoke tools rather than bypassing RLS. Keep backup and restore workflows manual, staging-only, and secret-free by default. Keep optional providers disabled unless explicitly configured.

**Tech Stack:** Next.js/TypeScript, Supabase JS, PostgreSQL migrations, Node test scripts, GitHub Actions, Expo/EAS.

**Spec:** `docs/superpowers/specs/2026-10-21-first-five-release-gaps.md`

## Global Constraints

- No production database mutation or customer data.
- No paid AI, telephony, claims, or pricing service.
- No credentials in source, logs, or GitHub artifacts.
- Live RLS testing requires dedicated synthetic users and an explicitly supplied non-production project.
- CI/build evidence never replaces authenticated browser, provider, or physical-device evidence.

## Review Focus

- Normal users can sign in without receiving the owner break-glass secret.
- Approval/migration checks fail closed when a binding or privilege marker is removed.
- Cross-workspace reads, writes, and private Storage access fail closed.
- Backup workflows cannot export production data by default or leak secrets.
- Status output distinguishes configured, disabled, stale, and unverified capabilities.

### Task 1: Restore normal Supabase authentication

**Files:** modify `app/auth/login/page.tsx`; add/update `scripts/auth-flow-test.mjs`.

- Add password sign-in, magic-link request, reset/signup links, safe-next handling, and clearly separated break-glass fallback.
- Test required controls and that the owner key remains server-side.
- Run `npm run test:auth-flow`, typecheck, and build.

### Task 2: Verify migration 053 source safety

**Files:** modify `scripts/agent-action-policy-test.mjs`, `.github/workflows/ci.yml`, `scripts/migration-safety-test.mjs` if needed.

- Assert pgcrypto, canonical hash recomputation, atomic transition, RLS, search path, revoke/grant, and prefix 054 guidance.
- Run focused tests and migration-safety workflow locally.

### Task 3: Add opt-in two-workspace RLS/Storage smoke harness

**Files:** create `scripts/two-workspace-isolation-test.mjs`; modify `package.json`, `README.md`, `OWNER-MANUAL.md`.

- Use Supabase JS with environment-only synthetic credentials.
- Require an explicit non-production marker; bound selects; use deterministic synthetic IDs; clean up only owned test rows/objects.
- Exit nonzero on cross-workspace visibility or mutation.
- Run only configuration validation without live credentials; never claim the live test passed.

### Task 4: Add safe backup/restore workflow

**Files:** create `.github/workflows/staging-backup-verify.yml`; modify `OWNER-MANUAL.md`.

- Manual dispatch only; protected environment; no production default; no unencrypted data artifacts.
- Validate Supabase CLI availability and migration/schema snapshot commands without printing secrets.
- Document encrypted-backup and disposable-staging prerequisites.

### Task 5: Reconcile current release truth

**Files:** modify `AUDIT-STATUS-2026-10-21.md`, `HANDOFF.md`, `OPERATING-CADENCE.md`, `PRICING-RELEASE-STATUS.md`, `README.md`.

- Add a current post-merge checkpoint at the actual baseline.
- Preserve historical entries and identify remaining unverified gates.

### Task 6: Strengthen mobile release gate

**Files:** modify `scripts/mobile-release-check.mjs`, `.github/workflows/mobile-apk.yml`, `MOBILE-FIELD-RELEASE.md`.

- Assert current client version/migration boundaries and fail clearly without Expo credentials.
- Keep CI artifact evidence distinct from physical-device evidence.

### Task 7: Make invitation flow testable and truthful

**Files:** inspect/modify invitation route and add `scripts/invitation-flow-test.mjs`; modify CI if appropriate.

- Cover admin-only creation, token acceptance, expiry/replay, and membership boundary contracts.
- Do not claim email delivery without a provider.

### Task 8: Add worker heartbeat/cron observability contract

**Files:** inspect `workers`, cron routes, migrations, and status route; add source contract/test and migration only if required.

- Record/report start, success/failure, stale heartbeat, and last error for internal workers.
- Keep missing worker configuration visibly unverified.

### Task 9: Harden production configuration truth

**Files:** modify `/api/status`, status tests, `.env.example`, and release checks.

- Flag localhost model endpoints in production, missing public Supabase config, and cron enabled without secret.
- Preserve optional-provider disabled states.

### Task 10: Add low-cost database security checks

**Files:** modify migration-safety checks and add only justified indexes/migration source if verified by query paths.

- Require explicit search paths and least-privilege grants for SECURITY DEFINER functions.
- Document dashboard-only leaked-password protection as an external gate.

## Final verification

Run focused tests for all ten tasks, then `npm run typecheck`, `npm run build`, `npm run audit`, `npm run verify:security`, `npm run release-check`, migration safety, mobile checks, the CI-equivalent suite, and `git diff --check`. Commit, push a PR, wait for all required checks, merge to `main`, and verify the post-merge workflow.
