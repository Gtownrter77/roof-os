# Database migration ordering

**Do not rename or renumber an already-released SQL migration without checking the applied production ledger first.** The production Supabase ledger uses timestamp versions; the repo SQL files use shorter numeric prefixes. The project was restored during this release and is now `ACTIVE_HEALTHY`.

## Production reconciliation

Production lists `035_retailer_quota_hardening` as applied (ledger version `20260919043845`). Its SQL existed on the orphaned branch `fix/retailer-quota-hardening-20260918` at commit `843bf3c`, but not on `main`. This release restores that exact migration source as `supabase/migrations/035_retailer_quota_hardening.sql`; **do not apply it again**. The live schema already contains its retailer quota functions.

## Known legacy local-prefix collisions

The repository retains the three historical duplicate numeric-prefix groups 021, 022, and 023. Current main contains migrations through prefix 043, including the production-applied receptionist workspace-integrity migration. Production also has the inspection/integrity sequence represented in source here as 044–048.

| Prefix | Files |
| --- | --- |
| `021` | `021_agent_runs_idempotency_contract.sql`, `021_photo_estimate_workflows.sql` |
| `022` | `022_photo_estimate_workflows.sql`, `022_soffit_measurement_fields.sql` |
| `023` | `023_photo_refresh_decisions.sql`, `023_soffit_measurement_fields.sql` |

The release checker locks this exact legacy set and fails if a new collision appears. The live ledger is timestamped and confirms individual migrations. Do not rename or reapply production-applied migrations. The source sequence 043–048 must remain aligned with the verified production ledger.

## Safe forward path

1. Before using `supabase migration repair`, renaming a historical file, or changing a production ledger, inspect the recorded production migration versions.
2. Keep released migration files immutable until the remote history is reconciled.
3. Give every new local migration a unique prefix greater than the highest released prefix. The current next slot is `049`.
4. Run the migration in a staging database first, then run the app/release checks against the migrated schema.
5. Record the migration name and its production apply status in the release/owner manual.

This branch reconciles production-applied migration history with source control: 043 is already present on main, and 044–048 now match the exact SQL from the earlier migration proposal after renumbering to avoid the 043 collision. Production 044–048 were applied and independently verified before this source reconciliation.


## CRM missing-spokes migration

`039_crm_missing_spokes.sql` adds first-class next actions, transparent lead scoring, structured lost reasons, and activity timestamps to the existing `leads` model. It does not introduce a second CRM, duplicate customer table, or second database. Apply it only after the existing 036–038 sequence has been reconciled in the target environment.
