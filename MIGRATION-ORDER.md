# Database migration ordering

## Current checkpoint — 2026-10-25

`main` is now `03d8cdd` after PRs #321–#323. Migrations `053_agent_action_ledger.sql`, `054_mobile_ai_observations.sql`, `055_passport_public_share.sql`, and `056_public_passport_rate_limit.sql` are present in source and covered by CI contracts. On 2026-10-26, migrations `053`–`056` were applied to production project `xksumagfbegdlapwysps` through the protected migration tool and recorded in the live ledger. The Agent Action Ledger tables/RPC, mobile observation table/triggers/RLS, passport columns/indexes, and rate-limit function are present. The live public endpoint returns `404` for an unknown token. The next new local prefix is `057`. Use the manual, protected staging workflow `.github/workflows/staging-migration-verify.yml` for future migrations; staging parity and authenticated two-workspace evidence remain unverified.

**Do not rename or renumber an already-released SQL migration without checking the applied production ledger first.** The production Supabase ledger uses timestamp versions; the repo SQL files use shorter numeric prefixes. The project was restored during this release and is now `ACTIVE_HEALTHY`.

> **Historical evidence note:** The 2026-10-09 audit found source drift involving migrations `051` and `052`. That finding is superseded by the 2026-10-26 live ledger check, which records migrations through `056`. Do not replay applied migrations; test future unapplied changes on staging before production.

## Production reconciliation

Production lists `035_retailer_quota_hardening` as applied (ledger version `20260919043845`). Its SQL existed on the orphaned branch `fix/retailer-quota-hardening-20260918` at commit `843bf3c`, but not on `main`. This release restores that exact migration source as `supabase/migrations/035_retailer_quota_hardening.sql`; **do not apply it again**. The live schema already contains its retailer quota functions.

## Known legacy local-prefix collisions

The current repository has three duplicate numeric prefixes. Migrations 036, 037, 038, 053, 054, 055, and 056 are already present on main; the next new local migration prefix is `057`.

| Prefix | Files |
| --- | --- |
| `021` | `021_agent_runs_idempotency_contract.sql`, `021_photo_estimate_workflows.sql` |
| `022` | `022_photo_estimate_workflows.sql`, `022_soffit_measurement_fields.sql` |
| `023` | `023_photo_refresh_decisions.sql`, `023_soffit_measurement_fields.sql` |

The release checker locks this exact legacy set and fails if a new collision appears. The live ledger is timestamped and confirms individual migrations; do not add files under any existing or duplicated numeric prefix.

## Duplicate migration contents found in the repository

In addition to the numeric-prefix collisions above, these pairs have identical SQL content in the current `main` snapshot:

- `021_photo_estimate_workflows.sql` and `022_photo_estimate_workflows.sql`
- `022_soffit_measurement_fields.sql` and `023_soffit_measurement_fields.sql`
- `023_photo_refresh_decisions.sql` and `024_photo_refresh_decisions.sql`

Treat this as a repository-history reconciliation task, not permission to delete or renumber files. Before any cleanup, compare the actual production migration ledger and the SQL state already applied. New work must use a unique prefix greater than `056`.

## Safe forward path

1. Before using `supabase migration repair`, renaming a historical file, or changing a production ledger, inspect the recorded production migration versions.
2. Keep released migration files immutable until the remote history is reconciled.
3. Give every new local migration a unique prefix greater than the highest released prefix. The next new local migration prefix is `057`.
4. Run the migration in a staging database first, then run the app/release checks against the migrated schema.
5. Record the migration name and its production apply status in the release/owner manual.

This change restores the missing source for a migration already applied remotely. It introduces no new production SQL and does not claim the three historical local-prefix collisions have been renumbered.


## CRM missing-spokes migration

`039_crm_missing_spokes.sql` adds first-class next actions, transparent lead scoring, structured lost reasons, and activity timestamps to the existing `leads` model. It does not introduce a second CRM, duplicate customer table, or second database. Apply it only after the existing 036–038 sequence has been reconciled in the target environment.
