# Database migration ordering

## Current checkpoint — 2026-11-02

- The audited GitHub `main` baseline was `b74d23431aa4affcf512710635197bc0e1923256`, whose source migration head was 074. Repair branch `fix/whisper-multipart-contract-20261102` adds source migration `075_atomic_canvass_knock.sql`; this file is not yet on `main`.
- Migration 075 defines the authenticated, workspace-scoped `log_canvass_knock` transaction. It creates or updates one normalized-address canvass lead and inserts its activity row atomically. It has **not** been applied to staging or production, and its live behavior has not been verified.
- The latest production ledger evidence preserved in the previous version of this document is dated 2026-10-26 and records migrations 053–056 as applied to project `xksumagfbegdlapwysps`. That old record does not establish whether 057–074 were later applied. The current production ledger and schema state are **unknown** until a fresh authorized read-only check is made.
- The next new local numeric prefix after this branch's 075 is 076. Do not allocate it until the branch is reconciled with current `main` and the target migration ledger.

Do not replay, rename, repair, or renumber a historical migration merely because a local filename differs from a remote migration ledger. The Supabase ledger uses timestamp versions while repository SQL filenames use shorter numeric prefixes. Keep source presence, staging application, and production application as separate facts.

## Known historical local-prefix collisions

The repository has three legacy duplicate numeric prefixes. Do not rename or delete these files without checking the applied target ledger and all migration-tool behavior.

| Prefix | Files |
| --- | --- |
| `021` | `021_agent_runs_idempotency_contract.sql`, `021_photo_estimate_workflows.sql` |
| `022` | `022_photo_estimate_workflows.sql`, `022_soffit_measurement_fields.sql` |
| `023` | `023_photo_refresh_decisions.sql`, `023_soffit_measurement_fields.sql` |

The following pairs also have identical SQL content in the repository history:

- `021_photo_estimate_workflows.sql` and `022_photo_estimate_workflows.sql`
- `022_soffit_measurement_fields.sql` and `023_soffit_measurement_fields.sql`
- `023_photo_refresh_decisions.sql` and `024_photo_refresh_decisions.sql`

Treat those as historical reconciliation, not permission to change production migration history. The release checker locks the existing duplicate-prefix set and must continue passing.

## Safe forward path

1. Obtain a fresh, read-only migration-ledger and schema-diff snapshot for the intended target. Do not infer applied state from repository filenames or these historic notes.
2. Test a new migration on the designated staging database, then run schema, authorization/RLS, and application checks against that migrated staging target.
3. For production, follow the protected migration workflow and verify backup/restore readiness, exact target identity, and owner approval before applying any SQL. Never replay already-applied migrations.
4. After an apply, record the migration version/name, target, time, and evidence source in this document and the release handoff. A green CI job alone is not proof of production application.

## Historical reconciliation notes

- Migration `035_retailer_quota_hardening.sql` was restored from an orphaned branch at commit `843bf3c`; the old checkpoint said production listed it as applied (`20260919043845`). This is historic evidence, not a freshly rechecked target state.
- Migration `039_crm_missing_spokes.sql` adds first-class next actions, lead scoring, structured lost reasons, and activity timestamps to the existing `leads` model. It does not introduce a second CRM.
- The older 2026-10-26 statement that 053–056 were applied remains archived above only as the latest recorded evidence available to this repair. Confirm a current target ledger before any future production migration.
