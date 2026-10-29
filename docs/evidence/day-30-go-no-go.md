# Day 30 — go/no-go decision

Date: 2026-10-28. Source repo: `Gtownrter77/roof-os`.

## Decision: NO-GO for customer-facing production use

The release decision is read from `docs/evidence/release-gates.json`. Every gate
is `UNKNOWN` because the required evidence has not been produced. `UNKNOWN` is
not a pass. `scripts/release-gate-summary.mjs` therefore reports **NO-GO**.

A limited internal rehearsal on disposable PostgreSQL is allowed. A production
deployment, production database migration, customer onboarding, insurer
submission, or payment capture is **not** authorized by this decision.

## Evidence ledger

| Gate | Status | What exists | What is missing |
| --- | --- | --- | --- |
| repositoryChecks | UNKNOWN | Required-check configuration on `main` | A green run on the final merge SHA |
| stagingMigration | UNKNOWN | Migrations 063-074 and disposable PostgreSQL assertions | Application of the migration chain to staging |
| authenticatedReadOnly | UNKNOWN | Source guards and Break Glass negatives | A real two-workspace Supabase Auth run |
| stagingRls | UNKNOWN | RLS/trigger assertions in disposable PostgreSQL | RLS verification against staging with real tokens |
| stagingHeartbeat | UNKNOWN | Worker heartbeat source tests | A running staging worker |
| physicalDevice | UNKNOWN | Mobile source and contract tests | Physical Android capture, offline reopen, private sync |
| backupRestore | UNKNOWN | Isolated CI dump/restore rehearsal | A real staging or production restore |
| schemaParity | UNKNOWN | Migration snapshot workflow (manual) | A staging-vs-migration diff |
| workerRuntime | UNKNOWN | Source and policy tests | A running worker and observed execution |
| providerExecution | UNKNOWN | Contract tests only | A real provider sandbox execution |

## What the disposable PostgreSQL rehearsal does prove

- The migrated schema applies from 063 through 074.
- One clean lifecycle runs from lead to warranty/passport.
- Fourteen exception paths are refused, including completion without closeout,
  voiding a paid invoice, and reopening a revoked warranty or passport.
- Tenant isolation holds for the tested policies in this database.
- A custom-format dump restores with matching row counts, lifecycle evidence,
  RLS, and guard triggers intact.

It does **not** prove Supabase Auth, Storage, browser behavior, mobile offline
behavior, staging parity, provider execution, or production readiness.

## Features that stay disabled or unclaimed

- No production deploy and no production database mutation.
- No public launch or public iOS release.
- No insurer submission, ESX generation, or carrier-coverage claim.
- No Stripe or automatic payment capture; payment rows are audit records only.
- No automatic warranty creation from Office Copilot or Agent 4.
- No autonomous agents, God Mode, or drone automation.
- No claim that the Roof Passport is an insurer document or proof of warranty.

## Rollback

Nothing has been deployed, so rollback is limited to source control:

1. Do not apply migrations 071-074 to production.
2. If a branch is merged by mistake, revert the merge commit on `main`; keep the
   migrations in the tree until a forward fix is reviewed.
3. If a staging migration is applied, restore the last verified staging dump
   before retrying.
4. If a pilot user reports cross-tenant data, stop use, preserve logs, and treat
   it as Severity 1.

## Conditions for a LIMITED GO

A LIMITED GO requires, at minimum:

1. Green required checks on the final merge SHA.
2. A real two-workspace Supabase Auth/Storage run with clean removal.
3. A staging migration plus schema-parity and RLS evidence.
4. A completed staging restore rehearsal.
5. One physical Android device completing capture, offline reopen, and sync.
6. A named pilot owner and field user trained under
   `docs/evidence/day-29-pilot-readiness.md`.
7. Explicit owner authorization for the deployment scope.

Until those exist, the only honest decision is NO-GO.
