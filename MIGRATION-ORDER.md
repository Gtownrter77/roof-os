# Database migration ordering

**Do not rename or renumber an already-released SQL migration without checking the applied production ledger first.** The production Supabase ledger uses timestamp versions; the repo SQL files use shorter numeric prefixes. The project was restored during this release and is now `ACTIVE_HEALTHY`.

## Production reconciliation

Production lists `035_retailer_quota_hardening` as applied (ledger version `20260919043845`). Its SQL existed on the orphaned branch `fix/retailer-quota-hardening-20260918` at commit `843bf3c`, but not on `main`. This release restores that exact migration source as `supabase/migrations/035_retailer_quota_hardening.sql`; **do not apply it again**. The live schema already contains its retailer quota functions.

## Known legacy local-prefix collisions

The current repository has three legacy duplicate numeric prefixes: 021, 022, and 023. Main contains migrations through 042. New work on this branch therefore uses 043, 044, 045, and 046, each with a unique prefix.

| Prefix | Files |
| --- | --- |
| `021` | `021_agent_runs_idempotency_contract.sql`, `021_photo_estimate_workflows.sql` |
| `022` | `022_photo_estimate_workflows.sql`, `022_soffit_measurement_fields.sql` |
| `023` | `023_photo_refresh_decisions.sql`, `023_soffit_measurement_fields.sql` |

The release checker locks this exact legacy set and fails if a new collision appears. The live ledger is timestamped and confirms individual migrations; do not add files under any existing or duplicated numeric prefix. Migrations 043, 044, 045, and 046 on this branch are new source changes and have not been applied to production.

## Safe forward path

1. Before using `supabase migration repair`, renaming a historical file, or changing a production ledger, inspect the recorded production migration versions.
2. Keep released migration files immutable until the remote history is reconciled.
3. Give every new local migration a unique prefix greater than the highest released prefix. New branch-local migrations use `043`, `044`, `045`, and `046`; all remain pending production verification.
4. Run the migration in a staging database first, then run the app/release checks against the migrated schema.
5. Record the migration name and its production apply status in the release/owner manual.

This change restores the missing source for a migration already applied remotely. It introduces no new production SQL and does not claim the three historical local-prefix collisions have been renumbered.


## CRM missing-spokes migration

`039_crm_missing_spokes.sql` adds first-class next actions, transparent lead scoring, structured lost reasons, and activity timestamps to the existing `leads` model. It does not introduce a second CRM, duplicate customer table, or second database. Apply it only after the existing 036–038 sequence has been reconciled in the target environment.
