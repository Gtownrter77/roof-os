# Database migration ordering

**Do not rename or renumber an already-released SQL migration without checking the applied production ledger first.** The production Supabase ledger uses timestamp versions; the repo SQL files use shorter numeric prefixes. The project was restored during this release and is now `ACTIVE_HEALTHY`.

## 2026-10-02 independent production audit

The read-only audit recorded production ledger version `20261002182249` as `receptionist_workspace_integrity`, after `20261002140543` `golden_report_review_controls`. The live receptionist booking function matches the hardened function in PR #72, but the migration source is not present on current `main`. Do not replay that migration or treat PR #72's open state as proof of deployment.

PR #70's `043_inspection_activity_atomicity.sql` and its related 044–047 migrations are not present in current `main` and their expected functions, triggers, and composite constraints were not found in production. The two open PRs use different `043` migration names; they must not be treated as interchangeable. See [`docs/PRODUCTION-AUDIT-2026-10-02.md`](docs/PRODUCTION-AUDIT-2026-10-02.md).

## Production reconciliation

Production lists `035_retailer_quota_hardening` as applied (ledger version `20260919043845`). Its SQL existed on the orphaned branch `fix/retailer-quota-hardening-20260918` at commit `843bf3c`, but not on `main`. This release restores that exact migration source as `supabase/migrations/035_retailer_quota_hardening.sql`; **do not apply it again**. The live schema already contains its retailer quota functions.

## Known legacy local-prefix collisions

The current repository has three duplicate numeric prefixes. Migrations 036, 037, and 038 are already present on main; the next new migration slot is 039.

| Prefix | Files |
| --- | --- |
| `021` | `021_agent_runs_idempotency_contract.sql`, `021_photo_estimate_workflows.sql` |
| `022` | `022_photo_estimate_workflows.sql`, `022_soffit_measurement_fields.sql` |
| `023` | `023_photo_refresh_decisions.sql`, `023_soffit_measurement_fields.sql` |

The release checker locks this exact legacy set and fails if a new collision appears. The live ledger is timestamped and confirms individual migrations; do not add files under any existing or duplicated numeric prefix.

## Safe forward path

1. Before using `supabase migration repair`, renaming a historical file, or changing a production ledger, inspect the recorded production migration versions.
2. Keep released migration files immutable until the remote history is reconciled.
3. Give every new local migration a unique prefix greater than the highest released prefix. Current `main` ends at `042`, but numeric `043` is reserved for explicit reconciliation because open PRs #70 and #72 use different 043 migration names; do not add or apply a new 043 by assumption.
4. Run the migration in a staging database first, then run the app/release checks against the migrated schema.
5. Record the migration name and its production apply status in the release/owner manual.

This change restores the missing source for a migration already applied remotely. It introduces no new production SQL and does not claim the three historical local-prefix collisions have been renumbered.


## CRM missing-spokes migration

`039_crm_missing_spokes.sql` adds first-class next actions, transparent lead scoring, structured lost reasons, and activity timestamps to the existing `leads` model. It does not introduce a second CRM, duplicate customer table, or second database. Apply it only after the existing 036–038 sequence has been reconciled in the target environment.
