# Next five release-evidence fixes — 2026-10-21

## Intent

Close exactly five remaining evidence and release-safety gaps. This batch is deliberately narrower than the previous one and does not add customer-facing product features.

## Items

### 1. Lock both staging workflows to an allowlisted non-production project

Strengthen `staging-migration-verify.yml` and `staging-backup-verify.yml` so they require `STAGING_PROJECT_REF`, reject missing target identity, and fail closed when the database URL does not contain the designated project reference or matches the configured production host. Keep both workflows manual, protected-environment, and free of production defaults.

### 2. Add a protected staging two-workspace RLS smoke workflow

Create a manual GitHub workflow that runs the existing synthetic isolation harness only with a protected `staging-rls` environment and explicit non-production confirmation. Require two dedicated synthetic users, Supabase URL/anon key, and the project-reference allowlist. Do not run on push/PR, do not upload secrets or data, and preserve the harness cleanup behavior.

### 3. Make backup verification evidence explicit and bounded

Harden the staging backup workflow and owner documentation so schema dumps are never uploaded, the workflow reports checksums and row-free metadata only, restore-check naming cannot imply an actual restore, and the owner gets a clear separate procedure for a real encrypted restore rehearsal. Add a contract test distinguishing dump/diff evidence from restore evidence.

### 4. Reconcile mobile release documentation and version contracts

Update `MOBILE-FIELD-RELEASE.md` to the actual field release `0.4.0`, current sign-out/retry/session recovery behavior, and the exact remaining physical-device gates. Add a deterministic contract requiring the app version, release document, and mobile workflow to agree, without claiming an APK or device test was completed.

### 5. Add a truthful live-release preflight contract

Add a CI-safe script and owner checklist that checks required production/staging variables by name, rejects public exposure of server secrets, reports which external gates are still unknown, and never performs network writes. It should make “repository green” visibly different from “production verified.”

## Non-goals

No production database mutation, real RLS test, backup restore, customer data, provider call, payment, APK build, or deployment configuration change will be performed by this batch. No new product feature will be implemented.

## Safe defaults and implementation calls

- A staging database URL must contain the configured `STAGING_PROJECT_REF`; a configured production host is always rejected.
- The RLS workflow runs only by manual dispatch in a protected environment and requires `ROOF_RLS_TEST_NONPROD=true` plus the existing synthetic-data confirmation.
- “Restore check” means schema diff/checksum only unless a separate future workflow actually restores into an isolated database; wording will say so plainly.
- The mobile source version remains the authority for the contract; the documentation and workflow must match it.
- The live-release preflight is static and environment-name based; it does not print values or call providers.

## Verification contract

Run focused workflow/RLS/backup/mobile/preflight contracts, typecheck, build, security, release, dependency audit, full CI-equivalent checks, workflow YAML parsing, and `git diff --check`. Commit this exact five-item batch, open a PR, wait for every required check, merge only when green, verify post-merge main CI, and stop.
