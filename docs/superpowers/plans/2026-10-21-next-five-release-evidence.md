# Next Five Release-Evidence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the next five external release gates safer and more truthful without adding product scope.

**Architecture:** Keep all checks manual and protected. Reuse the existing synthetic RLS harness and staging backup/migration workflows, adding project-reference allowlisting and explicit non-production confirmations. Add static contract tests for wording/version/preflight behavior; do not create new production side effects.

**Tech Stack:** GitHub Actions, Supabase CLI, Node.js contract scripts, Expo/React Native source metadata, Markdown owner documentation.

**Spec:** `docs/superpowers/specs/2026-10-21-next-five-release-evidence.md`

## Global Constraints

- Exactly five implementation items; no sixth feature enters this batch.
- No production database mutation, provider call, backup restore, APK build, or deployment configuration change.
- Staging workflows are manual, protected-environment, and fail closed on missing/mismatched project identity.
- Synthetic RLS data requires explicit non-production and cleanup confirmation.
- “Restore check” means schema diff/checksum only unless a future workflow actually restores into an isolated database.
- Repository/CI evidence must remain distinct from authenticated live or physical-device evidence.

## Review Focus

- A staging URL for the production project must be rejected by both workflows; covered by workflow contract assertions.
- An RLS workflow must not run on push/PR or without synthetic-data confirmation; covered by workflow contract assertions.
- Backup checksums must not become artifacts or imply restore success; covered by backup contract assertions.
- Mobile version/documentation drift must fail deterministically; covered by mobile release contract assertions.
- Preflight must not print secret values or perform network writes; covered by static source assertions.

---

### Task 1: Lock staging workflow targets

**Files:**
- Modify: `.github/workflows/staging-migration-verify.yml`
- Modify: `.github/workflows/staging-backup-verify.yml`
- Test: `scripts/staging-workflow-contract-test.mjs`

- [ ] Require `STAGING_PROJECT_REF` in both workflows and reject a missing value.
- [ ] Require the database URL to contain the project reference and reject a configured production host.
- [ ] Preserve manual dispatch, protected environments, no-artifact behavior, and read-only commands.
- [ ] Assert those boundaries in a new Node contract test.
- [ ] Run `node scripts/staging-workflow-contract-test.mjs` and YAML parsing; expect PASS.

### Task 2: Protected staging RLS smoke workflow

**Files:**
- Create: `.github/workflows/staging-rls-smoke.yml`
- Modify: `scripts/two-workspace-isolation-test.mjs` only if target allowlist markers are missing
- Test: `scripts/staging-workflow-contract-test.mjs`

- [ ] Add manual dispatch only, protected `staging-rls` environment, and contents-read permission.
- [ ] Require `STAGING_PROJECT_REF`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, the two synthetic user credentials, `ROOF_RLS_TEST_NONPROD=true`, and `ROOF_RLS_TEST_CONFIRM=I_UNDERSTAND_SYNTHETIC_DATA`.
- [ ] Fail closed if the Supabase URL does not contain the project reference or resembles the production host.
- [ ] Run `npm run test:two-workspace-isolation` with the protected environment secrets; do not upload output or run on pushes/PRs.
- [ ] Extend the workflow contract test to require cleanup invocation and non-production gates.

### Task 3: Backup evidence boundary

**Files:**
- Modify: `.github/workflows/staging-backup-verify.yml`
- Modify: `OWNER-MANUAL.md`
- Test: `scripts/backup-evidence-contract-test.mjs`

- [ ] Require `STAGING_PROJECT_REF` and apply the same host/URL allowlist as Task 1.
- [ ] Rename restore-check wording to “non-destructive schema diff check” wherever it could imply a restore.
- [ ] Keep dumps and diffs in ephemeral `/tmp` paths, remove them, and never upload artifacts.
- [ ] Add owner instructions that an actual encrypted restore rehearsal is a separate future gate.
- [ ] Assert dump, checksum, cleanup, no-artifact, and no-restore-claim markers; run the contract test.

### Task 4: Mobile release version contract

**Files:**
- Modify: `MOBILE-FIELD-RELEASE.md`
- Test: `scripts/mobile-release-contract-test.mjs`
- Inspect: `apps/field/package.json`, `.github/workflows/mobile-apk.yml`, `scripts/mobile-release-check.mjs`

- [ ] Reconcile the document header and current release section to field version `0.4.0`.
- [ ] Document current sign-out, retained local evidence, manual retry-now, session-expiry recovery, and the remaining physical-device gates.
- [ ] Require the source app version, release document version, and mobile workflow version markers to agree without claiming an APK/device pass.
- [ ] Run the new contract plus existing mobile release checks.

### Task 5: Static live-release preflight

**Files:**
- Create: `scripts/live-release-preflight.mjs`
- Create: `scripts/live-release-preflight-test.mjs`
- Modify: `package.json`
- Modify: `OWNER-MANUAL.md`
- Modify: `.github/workflows/ci.yml`

- [ ] Implement a static preflight that reads only variable names/source text, never values, never calls the network, and reports missing/unknown release gates.
- [ ] Reject source patterns that expose `SUPABASE_SERVICE_ROLE_KEY`, provider secrets, or `CRON_SECRET` through `NEXT_PUBLIC_*` or browser/mobile bundles.
- [ ] Add an npm script and required CI invocation with safe validation-only inputs.
- [ ] Document that a PASS means repository hygiene only, not live production verification.
- [ ] Run the preflight contract, full local gate, and CI-equivalent suite.

## Final verification

Run focused five-item contracts, mobile TypeScript, root typecheck, build, release check, security checks, full existing regression suite, dependency audit, workflow YAML parsing, and `git diff --check`. Commit one branch/PR containing exactly these five items, wait for all required checks, merge only when green, verify post-merge main CI, and stop.
