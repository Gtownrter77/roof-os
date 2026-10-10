# ROOF/OS audit status — 2026-10-09

## Evidence baseline

- Repository: `Gtownrter77/roof-os`
- Audited `main` commit: `a308459182e9a6867fb736240c6dc2af9f3aa6e9`
- Main CI: [run 37974227416](https://github.com/Gtownrter77/roof-os/actions/runs/37974227416) completed successfully for that SHA.
- Repository metadata at audit time: 80 branches; no open pull requests.
- The `main` ruleset requires pull requests and the `web`, `mobile`, and `migration-safety` checks. It does not require an approving review.
- Rollback references created before this cleanup:
  - `backup/pre-comprehensive-audit-20261009` — main baseline above.
  - `backup/pre-jules-pipeline-disable-20261009` — prior head of the Jules prototype branch.

## Confirmed working

- The latest observed main CI run completed with conclusion `success`.
- The main branch build and typecheck completed successfully in the observed CI run.
- The current CI workflow includes web, mobile, preview build, and migration-safety jobs, along with static and regression checks.
- GitHub reported a Vercel success status context for the audited main SHA; the current PR preview also reported deployment completion, but I could not inspect runtime logs through the Vercel connector.
- Connected production Supabase project reports `ACTIVE_HEALTHY`, has 53 public tables with RLS enabled, no public views, and 56 applied timestamped migrations. Read-only SQL checks confirmed no unconditional public read policies and no missing `WITH CHECK` clauses in the checked insert/update policies.

These results apply to the recorded commit and automated checks only; they do not establish that every business workflow is correct in production.

## Confirmed problems

1. **Unsafe legacy prototype on a non-main branch.** The Jules branch's `app/api/photo-estimate/pipeline/route.ts` called a prototype engine that returns hard-coded example addresses, roof quantities, prices, storm history, and fallback customer contact details. The route also accepted raw `request.json()` without an authentication check. This is not evidence that the endpoint exists on current main or is exposed in production.
2. **Fabricated sample data in current main.** The canvassing page displayed Homer Simpson at Evergreen Terrace, a fabricated inspector name/contact/license, and a fixed storm date. The customer portal displayed four fictional customers, and notifications displayed six invented alerts as if recent. The canvassing mentor also made unsupported claims about hail damage and insurance-rate effects. These UI values were removed on the audit branch; canvassing now labels unconverted pins as session-only, the portal directs users to real leads, notifications show an honest unconnected empty state, and the script guide avoids unsupported insurance guarantees.
3. **Duplicate migration SQL.** Current main has identical contents in these pairs:
   - `021_photo_estimate_workflows.sql` / `022_photo_estimate_workflows.sql`
   - `022_soffit_measurement_fields.sql` / `023_soffit_measurement_fields.sql`
   - `023_photo_refresh_decisions.sql` / `024_photo_refresh_decisions.sql`
4. **Stale migration guidance.** The prior guide said the next prefix was `039`, but repository files extend through `052`. The guide now says `053` is the next new local prefix and documents the duplicate-content finding. The old migrations were not renamed or deleted.
5. **Stale status snapshots.** README and CURRENT-STATE contained old baseline SHAs and historical deployment/test statements that could be mistaken for current verification. They now identify the current baseline and link this report.
6. **Production migration source drift.** The live ledger includes applied entries `044_inspection_activity_atomicity`, `045_lead_next_action_owner_integrity`, `046_lead_workspace_audit_integrity`, `047_photo_estimate_workspace_integrity`, and `048_lead_owner_workspace_integrity`. Their executable migration source is absent from current `supabase/migrations/`, but the five matching files were recovered on historical branch `fix/reality-integrity-clean-main` at commit `aa47e4a1dbb8fd3806a1a4da3c4e755341f6ede1`. They have not been restored to `main`; do not copy them into the executable migration directory under conflicting prefixes or replay them. The exact bytes applied in production cannot be verified from the timestamped ledger alone.
7. **Supplier add-on pricing is not enabled in production.** Live provider constraints and `reserve_retailer_price_query` only allow `home_depot` and `lowes`, although routes for `abc`, `srs`, and `beacon` exist. The migration `051_supplier_account_addons.sql` was not applied according to the ledger and did not update the function allowlist. The audit branch now updates both constraints and the quota function, with a release-check regression assertion.
8. **Mobile field measurement schema is missing in production.** `inspection_measurements` lacks `rafter_lf`, `soffit_lf`, `fascia_lf`, and `roof_type`; migration `052_mobile_field_measurement_inputs.sql` is not recorded in the live ledger. Mobile sync writes for these fields can fail until the migration is safely applied.
9. **Supabase advisor warnings.** Security advisor: leaked-password protection disabled; six authenticated-executable `SECURITY DEFINER` functions flagged for review. Their current definitions were inspected and contain relevant authorization checks and search-path settings. Performance advisor: 87 unindexed foreign keys, 46 RLS initialization-plan warnings, 105 multiple-permissive-policy warnings, and 48 unused indexes. These require staged, table-specific changes rather than a bulk production rewrite.
10. **CI write-job scope.** The `refresh-field-lock` job has `contents: write` and pushes to a branch. It was not gated away from pull-request events. The workflow now limits this writer job to non-main push events, avoiding branch-name resolution and writes during PR runs.

## Fixes made on branches

- On `audit/fix-verified-findings-20261009`:
  - Restricted the lockfile-writing CI job to non-main push events.
  - Updated the un-applied supplier add-on migration so the server-side quota function accepts the same provider set as the table constraints; added a release-check guard for this contract.
  - Corrected migration-order documentation to the current repository migration head and documented duplicate SQL without rewriting history.
  - Added this status report and marked older README/CURRENT-STATE checkpoints as historical.
  - Removed fabricated canvassing pins, fake inspector credentials, fake portal customers, and invented notification records.
  - Replaced unsupported canvassing/insurance claims with cautious, non-authoritative wording.
  - Added regression assertions preventing those fake records from returning.
- On `jules-8591243431038068273-0357cdff`:
  - Replaced the unauthenticated prototype endpoint with a fail-closed handler requiring an authenticated user, an active workspace, and workspace-admin authorization.
  - Added the bounded JSON reader.
  - Disabled execution of the hard-coded prototype outputs; the route returns HTTP 503 until real provider integrations, persistence, and review authorization are implemented.
  - Pre-change head is preserved at `backup/pre-jules-pipeline-disable-20261009`.

## Not verified in this audit

- Live Vercel application behavior and end-to-end workflows (the commit had a Vercel success status context, but no live workflow was exercised).
- Full end-to-end RLS isolation tests across real authenticated users and separate workspaces; only metadata and read-only policy checks were run.
- Applying migrations 051 and 052 to a staging database and then production; no staging branch exists, and no production DDL was applied.
- Physical Pixel 8 APK installation, sign-in, camera capture, offline sync, and upload.
- Current GitHub dependency/security-alert inventory and a fresh local dependency audit.
- Restoring the recovered 044–048 source into a clearly non-executable archive on `main`, and finding/recovering source for other production ledger names that have no matching file.

## Verification rule

Do not merge cleanup into `main` until the required checks pass on the exact proposed commit. Do not delete branches or alter applied migration history as part of cosmetic cleanup. Production and device claims require separate evidence.
