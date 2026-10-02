## 2026-10-02 Current Migration Evidence

Observed directly in production project xksumagfbegdlapwysps and against current main 41162bb9359ffb26dac40dc993e59795af3a70e5:

- 040_production_schema_hardening.sql exists in main.
- 041_aerial_workspace_consistency.sql exists in main.
- 042_golden_report_review_controls.sql exists in main.
- Production also contains migration 20261002182249 named receptionist_workspace_integrity, corresponding to 043_receptionist_workspace_integrity.sql from PR #72.
- Live schema verification shows public.leads.workspace_id is NOT NULL.
- Live function verification shows public.book_receptionist_appointment exists as SECURITY DEFINER; the migration source revokes execution from public, anon, and authenticated and grants it to service_role.

Migration-prefix collision is now a production/source-drift issue: PR #70 still contains 043_inspection_activity_atomicity.sql, while PR #72 contains the different 043_receptionist_workspace_integrity.sql that has already been applied to production. Do not merge, rename, or apply PR #70's 043 blindly. It needs a new forward migration number and dependency review against the now-applied receptionist migration.

Production migration application status for later migrations beyond the observed receptionist migration remains UNVERIFIED.

# Database migration ordering

**Do not rename or renumber an already-released SQL migration without checking the applied production ledger first.** The production Supabase ledger uses timestamp versions; the repo SQL files use shorter numeric prefixes. The project was restored during this release and is now `ACTIVE_HEALTHY`.

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
3. Give every new local migration a unique prefix greater than the highest released prefix. The current next slot is `039`.
4. Run the migration in a staging database first, then run the app/release checks against the migrated schema.
5. Record the migration name and its production apply status in the release/owner manual.

This change restores the missing source for a migration already applied remotely. It introduces no new production SQL and does not claim the three historical local-prefix collisions have been renumbered.


## CRM missing-spokes migration

`039_crm_missing_spokes.sql` adds first-class next actions, transparent lead scoring, structured lost reasons, and activity timestamps to the existing `leads` model. It does not introduce a second CRM, duplicate customer table, or second database. Apply it only after the existing 036–038 sequence has been reconciled in the target environment.
