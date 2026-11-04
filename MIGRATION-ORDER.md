## Current checkpoint — 2026-11-02

Production project `xksumagfbegdlapwysps` has the following current ledger sequence after the 2026-10-26 checkpoint:

- `057 workspace_feature_flags_reconcile_20261101`
- `058` is already applied as the production timestamped alias `atomic_estimate_line_item_replacement`; do not replay it.
- `059 estimate_approval_admin_guard` through `072 production_invoice_payment`
- `073 warranty_passport_legacy_compatible`
- `074 payment_warranty_lifecycle_guards_legacy_compatible`
- `075 harden_security_definer_triggers`
- `076 private_passport_rate_limit`
- `077 harden_remaining_security_definers`
- `078 explicitly_deny_public_rate_limit_clients`

The source files for 073–074 were rewritten additively before production application. Existing legacy warranty fields (`registration_status`, `passport_id`, `lead_id`) and Roof Passport fields (`status`, `lead_id`, `public_token`, `public_shared`) remain intact. Job-linked lifecycle state is stored separately. Migration 075 sets an empty `search_path` and revokes direct API execution from every SECURITY DEFINER trigger function; authenticated execution remains on `is_estimate_admin(uuid)` because it is used by RLS policies, while anonymous execution is revoked.

Post-apply verification found 33 SECURITY DEFINER trigger functions with empty search paths and no anon/authenticated EXECUTE grants. Authenticated rollback-only production tests passed for legacy warranty registration and passport homeowner sharing; cross-workspace inserts were rejected. The transaction rolled back and production still has zero warranty/passport/job/invoice rows.

The next new repository migration prefix is **079**. Never renumber or replay any applied migration. The current branch's PostgreSQL CI rehearsal applies 075 in isolated test databases and verifies that the trigger functions still execute after their direct API grants are revoked. Migration 076 also revokes direct table access to `public.public_access_rate_limits` from `PUBLIC`, `anon`, and `authenticated`; the server-side RPC remains service-role-only and now has an empty search path. Live ACL checks confirmed client roles have no table or RPC access and the service-role RPC still works. Migration 077 sets an empty search path on every remaining public SECURITY DEFINER function while preserving all existing execute grants. Migration 078 adds an explicit deny policy for anon/authenticated on `public_access_rate_limits`; the Supabase RLS-enabled/no-policy informational finding is now cleared while the service-role RPC still succeeds. Live verification: 46/46 public SECURITY DEFINER functions have empty search paths, zero are executable by anon, and the eight intentionally authenticated helpers/RPCs remain callable. Authenticated workspace helpers, retailer reservation, automation seeding, lead scoring and agent approval were exercised in rollback-only calls after hardening. The remaining eight authenticated SECURITY DEFINER warnings are therefore grant-surface warnings, not mutable-search-path warnings; do not revoke workspace/authentication primitives without a separate authority review. The 127 unindexed-FK advisor notices require workload/table-size analysis before adding indexes. Vercel deployed-code parity remains unverified.

# Database migration ordering

## Current checkpoint — 2026-11-02

- The audited GitHub `main` baseline was `b74d23431aa4affcf512710635197bc0e1923256`, whose source migration head was 074. Repair branch `fix/whisper-multipart-contract-20261102` adds source migration `075_atomic_canvass_knock.sql`; this file is not yet on `main`.
- Migration 075 defines the authenticated, workspace-scoped `log_canvass_knock` transaction. It creates or updates one normalized-address canvass lead and inserts its activity row atomically. It has **not** been applied to staging or production, and its live behavior has not been verified.
- A fresh read-only Supabase MCP snapshot on 2026-11-02 for the configured active `Roof OS` project (`xksumagfbegdlapwysps`) lists the target ledger through version `20261102025551` (`payment_warranty_lifecycle_guards_legacy_compatible`), corresponding to the source boundary at 074. It lists the intervening 057–074 migrations that were absent from the older Oct 26 note.
- The same read-only schema snapshot confirms RLS-enabled `leads`, `lead_activity`, and `workspace_settings` tables, the Canvass setting column, and existing `current_workspace_id()` / `is_workspace_member(uuid)` helpers. A bounded catalog query returned no `public.log_canvass_knock` function. Therefore the new canvass RPC is **not** deployed to this project and Canvass must not be described as using the new atomic path there yet.
- Only one active project was returned by the configured Supabase connector; no separate staging project was visible. No migration or database write was made. Staging migration/RLS verification remains **unverified**, and the approved production release path remains unresolved.
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
- The older 2026-10-26 statement that 053–056 were applied is superseded by the Nov 2 read-only snapshot above; it remains here only as historical context.
