# ROOF/OS Production PostgreSQL/Supabase Audit

**Audit date:** 2026-10-02  
**Repository:** `Gtownrter77/roof-os` (`main`, HEAD `f299810`)  
**Production Supabase project:** `xksumagfbegdlapwysps` (`Roof OS`, `us-east-1`)  
**Scope:** Read-only verification. No production schema, function, policy, trigger, or data changes were executed.

## Executive verdict

- **VERIFIED:** Production is ahead of current GitHub `main` by one durable migration: `20261002182249 / receptionist_workspace_integrity`.
- **VERIFIED:** That live receptionist booking function matches PR #72's function behavior, signature, empty `search_path`, workspace/lead checks, idempotency logic, and worker-only EXECUTE boundary.
- **VERIFIED MISMATCH:** PR #70's `043_inspection_activity_atomicity.sql` is not applied in production. Its expected functions, triggers, and composite constraints are absent.
- **VERIFIED MISMATCH:** Current `main` has no `043`–`047` migration files. PR #70 and PR #72 are open and unmerged; their changes are not part of current `main`.
- **VERIFIED:** Current `main` contains duplicate numeric prefixes `021`, `022`, and `023`. This is a repository migration-order defect; production's timestamp ledger avoids those numeric names.
- **UNVERIFIED:** The full production history of the receptionist migration cannot be reconstructed from the ledger alone beyond its recorded timestamp/name. The database object and PR source establish the effective live state, not the deployment actor or deployment command.

---

## 1. PRODUCTION FACTS

### 1.1 Project identity

**Source B — production:** Supabase project listing returned exactly project `xksumagfbegdlapwysps`, name `Roof OS`, status `ACTIVE_HEALTHY`, PostgreSQL 17.6.1.155.

**Result: VERIFIED.** The requested project was queried directly.

### 1.2 Core table state

The production table inspection returned these objects with RLS enabled:

| Table | RLS | Relevant live columns / facts |
|---|---:|---|
| `leads` | enabled | `workspace_id` NOT NULL; `status` NOT NULL; `next_action`, `next_action_due`, `next_action_owner_id` nullable |
| `appointments` | enabled | `workspace_id` NOT NULL; nullable `lead_id`; `created_by` NOT NULL; `status` default `scheduled` |
| `receptionist_events` | enabled | `workspace_id` NOT NULL; event-keyed receptionist audit table |
| `workspace_members` | enabled | composite primary key `(workspace_id,user_id)`; role check owner/admin/member |
| `lead_activity` | enabled | `lead_id` and `workspace_id` NOT NULL |
| `inspection_sessions` | enabled | `workspace_id` and `created_by` NOT NULL; nullable `lead_id`; status check draft/in_progress/completed/cancelled; nullable `client_id` |
| `inspection_photos` | enabled | `workspace_id` NOT NULL; nullable `client_id`; upload-status check |
| `workspaces` | enabled | `created_by` NOT NULL |
| `tasks` | enabled | `workspace_id` and `created_by` NOT NULL; nullable `lead_id` and `appointment_id` |

**Source B — exact query:** `supabase.list_tables(project_id, schemas=[public], verbose=true)` and an `information_schema.columns` query selecting the scoped columns.

### 1.3 Production row counts

Exact count query results at audit time:

| Table | Rows |
|---|---:|
| `appointments` | 0 |
| `inspection_photos` | 1 |
| `inspection_sessions` | 3 |
| `lead_activity` | 2 |
| `leads` | 2 |
| `receptionist_events` | 0 |
| `tasks` | 3 |
| `workspace_members` | 2 |

These counts are read-only observations and are not used as proof that a migration was or was not applied.

---

## 2. MIGRATION LEDGER

### 2.1 Applied migration records around the requested range

The production migration ledger returned the following relevant tail:

| Applied version | Applied name |
|---|---|
| `20260919043839` | `034_mobile_offline_idempotency` |
| `20260919043845` | `035_retailer_quota_hardening` |
| `20260930165224` | `photo_estimate_ai_analysis` |
| `20261002132705` | `aerial_geometry_suggestions` |
| `20261002132710` | `estimate_packet_photo_workflow_source` |
| `20261002132717` | `crm_missing_spokes` |
| `20261002133015` | `production_schema_hardening` |
| `20261002134443` | `aerial_workspace_consistency` |
| `20261002140543` | `golden_report_review_controls` |
| `20261002182249` | `receptionist_workspace_integrity` |

**Source B — exact query:**

```sql
SELECT version, name
FROM supabase_migrations.schema_migrations
WHERE version >= '040'
   OR name ILIKE '%receptionist%'
   OR name ILIKE '%inspection%'
ORDER BY version
LIMIT 100;
```

The Supabase migration-list tool returned the same ledger, including all earlier timestamped entries.

### 2.2 Order and conflicts

- **VERIFIED:** Production applies migrations by timestamped versions. `receptionist_workspace_integrity` is last among the returned rows and follows `golden_report_review_controls`.
- **VERIFIED:** No production ledger row named `043_inspection_activity_atomicity`, `044_lead_next_action_owner_integrity`, `045_lead_workspace_audit_integrity`, `046_photo_estimate_workspace_integrity`, or `047_lead_owner_workspace_integrity` was returned.
- **VERIFIED:** Current `main` has files `039_crm_missing_spokes.sql`, `040_production_schema_hardening.sql`, `041_aerial_workspace_consistency.sql`, and `042_golden_report_review_controls.sql`, but no `043`–`047` files.
- **VERIFIED:** Current `main` has numeric-prefix conflicts: `021_agent_runs_idempotency_contract.sql` and `021_photo_estimate_workflows.sql`; `022_photo_estimate_workflows.sql` and `022_soffit_measurement_fields.sql`; `023_photo_refresh_decisions.sql` and `023_soffit_measurement_fields.sql`.
- **UNVERIFIED:** The ledger alone cannot prove whether an operator renamed a migration before applying it, or whether any manual SQL was executed outside the migration runner.

### 2.3 Source A — current `main`

Current `main` migration evidence:

- `supabase/migrations/039_crm_missing_spokes.sql` adds the next-action columns, lead scoring, activity timestamp trigger, and score triggers.
- `supabase/migrations/040_production_schema_hardening.sql` adds aerial/geometry indexes and resets geometry write policies.
- `supabase/migrations/041_aerial_workspace_consistency.sql` creates `enforce_aerial_workspace_consistency()` and four geometry consistency triggers.
- `supabase/migrations/042_golden_report_review_controls.sql` adds technician/manager review fields and approval constraints to `photo_estimate_workflows`.

**Result: VERIFIED MATCH** for the corresponding production ledger names `crm_missing_spokes`, `production_schema_hardening`, `aerial_workspace_consistency`, and `golden_report_review_controls` at the migration-name level. Object-level checks are recorded below.

---

## 3. 043–047 RECONCILIATION

### 3.1 PR #70 — inspection activity atomicity

**Source A — PR #70:** Open PR titled `fix: preserve inspection actions in lead activity history`, head branch `fix/activity-continuity-20261002`, base `main`. Its diff adds:

- `043_inspection_activity_atomicity.sql`
  - `record_inspection_appointment_activity()` SECURITY DEFINER, `search_path = public`.
  - `appointment_inspection_activity` AFTER INSERT trigger on `appointments`.
  - `record_inspection_start_activity()` SECURITY DEFINER, `search_path = public`.
  - `inspection_session_start_activity` AFTER INSERT trigger on `inspection_sessions`.
  - workspace-member and lead/workspace checks.
  - inserts into `lead_activity` with `appointment_scheduled:` and `inspection_started:` bodies.
- `044_lead_next_action_owner_integrity.sql`
  - `ensure_lead_next_action_owner()` and `leads_next_action_owner_workspace_guard`.
- `045_lead_workspace_audit_integrity.sql`
  - `leads_id_workspace_key` and composite foreign keys `lead_activity_lead_workspace_fkey` and `lead_status_history_lead_workspace_fkey`.
- `046_photo_estimate_workspace_integrity.sql`.
- `047_lead_owner_workspace_integrity.sql`.

**Source A — exact repository evidence:** PR #70 diff, especially `supabase/migrations/043_inspection_activity_atomicity.sql` and the following `044`–`047` files in that diff. The current `main` tree does not contain these files.

**Source B — production:** A catalog query for the expected functions, trigger names, and constraint names returned `[]`. The live trigger inventory includes no appointment trigger and no inspection-session start trigger. The live function inventory includes no `record_inspection_appointment_activity`, `record_inspection_start_activity`, `ensure_lead_next_action_owner`, `enforce_photo_estimate_workspace_consistency`, or `enforce_lead_owner_workspace`.

**Result: VERIFIED MISMATCH.** PR #70 is not applied in any form detectable through the expected database objects. This conclusion does not rely on migration filenames alone.

### 3.2 PR #72 — receptionist workspace integrity

**Source A — PR #72:** Open PR titled `fix (chat): harden receptionist workspace and payment boundaries`, head branch `backend/production-hardening-20261002`, base `main`. Its migration source is `supabase/migrations/043_receptionist_workspace_integrity.sql`.

**Source A function behavior:**

- sets `leads.workspace_id` NOT NULL;
- replaces `book_receptionist_appointment(uuid, uuid, text, timestamptz, text, uuid, text)`;
- uses `SECURITY DEFINER` and `SET search_path = ''`;
- rejects missing required fields;
- requires the booking creator to be a member of the target workspace;
- requires the lead to belong to the target workspace;
- uses an advisory transaction lock;
- reads idempotency state from `receptionist_events` scoped by workspace;
- rejects overlapping non-cancelled appointment windows;
- creates a 30-minute inspection appointment and audit event;
- revokes EXECUTE from `public`, `anon`, and `authenticated` and grants it to `service_role`.

**Source B — production function query:**

```sql
SELECT p.oid::regprocedure AS signature,
       p.prosecdef AS security_definer,
       p.proconfig,
       pg_get_userbyid(p.proowner) AS owner,
       p.proacl,
       pg_get_functiondef(p.oid) AS definition
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'book_receptionist_appointment'
LIMIT 10;
```

Production returned:

- signature exactly `book_receptionist_appointment(uuid,uuid,text,timestamp with time zone,text,uuid,text)`;
- `security_definer = true`;
- `proconfig = {search_path=""}`;
- owner `postgres`;
- ACL `{postgres=X/postgres,service_role=X/postgres}`;
- a function body matching PR #72's function body and checks described above.

Production also reports `leads.workspace_id` as NOT NULL.

**Result: VERIFIED MATCH** for the deployed function behavior/content and privilege boundary. **UNVERIFIED** for the exact transaction wrapper/deployment event because PostgreSQL stores the resulting function/object state, not the original migration file or operator action.

### 3.3 Why the same numeric prefix does not establish identity

PR #70 and PR #72 each introduce a file named `043_...`, but they are different migrations with different functions and purposes. Current `main` contains no `043` file. Production uses timestamped ledger versions and records `receptionist_workspace_integrity`, not `043_inspection_activity_atomicity`.

**Result: VERIFIED:** filename/prefix alone cannot establish application. The live object checks distinguish the two migrations.

---

## 4. GITHUB ↔ PRODUCTION DIFFERENCES

| Area | Source A — GitHub | Source B — production | Result |
|---|---|---|---|
| Current `main` migration tail | Stops at `042_golden_report_review_controls.sql` | Has `receptionist_workspace_integrity` after the 042-equivalent ledger entry | **VERIFIED MISMATCH; production ahead** |
| PR #70 inspection activity | Adds two activity functions and two triggers | None of the expected functions/triggers exist | **VERIFIED MISMATCH; GitHub PR ahead** |
| PR #70 composite workspace FKs | Adds named composite constraints | Expected named constraints absent | **VERIFIED MISMATCH; GitHub PR ahead** |
| PR #72 receptionist function | Migration source contains hardened worker-only function | Live function/body/security boundary present | **VERIFIED MATCH** |
| Current `main` `leads.workspace_id` | `039` does not set it NOT NULL | Production reports NOT NULL | **VERIFIED MISMATCH relative to current-main source; production ahead** |
| Current `main` geometry consistency | `041` defines four consistency triggers | Four corresponding live triggers exist | **VERIFIED MATCH** |
| Current `main` lead-activity timestamp | `039` defines `lead_activity_updates_lead` | Corresponding live trigger exists | **VERIFIED MATCH** |
| Numeric migration prefixes | Duplicate 021/022/023 files | Timestamped production ledger has unique versions | **VERIFIED MISMATCH in repository hygiene; production ledger not numerically conflicted** |

### Later PR review

The GitHub PR listing showed PRs #73, #72, #71, and #70 as the latest open PRs at audit time. PR #73 is documentation-only by title and does not establish database application. No later merged PR was found in the latest PR list that supersedes the PR #70/#72 object scope.

**Result: VERIFIED for the inspected PR list; NOT VERIFIED as a proof against every historical manual database action.**

---

## 5. SECURITY FINDINGS

### 5.1 RLS

**VERIFIED:** RLS is enabled on all requested core tables, including `leads`, `appointments`, `receptionist_events`, `workspace_members`, `lead_activity`, `inspection_sessions`, `inspection_photos`, `workspaces`, and `tasks`.

The live policy predicates are workspace-scoped. Examples:

- `leads`, `appointments`, `inspection_sessions`, `inspection_photos`, `lead_activity`, `tasks`: SELECT predicates use `is_workspace_member(workspace_id)`.
- INSERT policies additionally bind creator/author fields to `auth.uid()` where applicable.
- receptionist write policies use `is_workspace_admin(workspace_id)` except the event insert policy, which checks admin membership in its `WITH CHECK`.
- geometry policies use workspace membership and creator ownership for write operations.

**Result: VERIFIED** that the inspected RLS predicates express workspace boundaries. A full adversarial cross-workspace session test using two authenticated users was not executed; **NOT VERIFIED** at runtime.

### 5.2 Grants

Production table ACLs grant broad table privileges to `anon`, `authenticated`, and `service_role`, while RLS remains enabled. This is common Supabase role setup, but it means RLS is the effective boundary.

**Source B query:** `pg_class.relacl` and `pg_policies` catalog queries.

**Result: VERIFIED:** broad base table grants exist. **VERIFIED:** RLS policies are present on the inspected tables. **NOT VERIFIED:** behavior for every role/action combination under live JWT claims.

### 5.3 SECURITY DEFINER functions

The live function inventory found these relevant SECURITY DEFINER functions: `is_workspace_member`, `is_workspace_admin`, `current_workspace_id`, `accept_workspace_invitation`, `create_default_lead_followup`, `handle_new_user_workspace`, `record_lead_status_change`, `refresh_lead_activity_timestamp`, `refresh_lead_score`, and `refresh_lead_score_trigger`.

- **VERIFIED SAFE FOR THE RECEPTIONIST BOOKING FUNCTION:** empty search path; fully schema-qualified references in the recorded body; EXECUTE only for `service_role` and owner `postgres`.
- **VERIFIED:** the other listed SECURITY DEFINER functions use `search_path=public`.
- **VERIFIED:** the `public` schema ACL does not grant CREATE to ordinary roles in the observed ACL; however, this audit did not retrieve and line-review every SECURITY DEFINER body.
- **UNVERIFIED:** complete safety of every SECURITY DEFINER function, including every dynamic SQL path and every object reference.

### 5.4 Security-relevant mismatch

**VERIFIED MISMATCH:** PR #70's inspection-start and appointment-activity checks are not in production. Therefore production does not have those additional atomic lead-activity and workspace-consistency protections, regardless of whether the current application performs similar checks elsewhere.

---

## 6. DATA/SCHEMA INTEGRITY FINDINGS

- **VERIFIED:** `leads.workspace_id` is NOT NULL in production. This is a production schema fact and is not present in current `main`'s 039 migration source; it is attributable to the live receptionist-integrity change or an equivalent prior/manual change, with the exact origin not independently provable from the ledger alone.
- **VERIFIED:** `lead_activity` has NOT NULL `lead_id` and `workspace_id`, but PR #70's named composite foreign key was not found.
- **VERIFIED:** the requested appointment, inspection, lead, activity, and workspace tables exist and have RLS enabled.
- **VERIFIED:** the four aerial workspace consistency triggers from current `main` migration 041 exist in production: `aerial_measurements_workspace_consistency`, `roof_planes_workspace_consistency`, `roof_edges_workspace_consistency`, and `roof_objects_workspace_consistency`.
- **VERIFIED:** the 039 lead activity timestamp trigger and lead scoring/status triggers exist.
- **VERIFIED:** no appointment or inspection-start activity trigger exists.
- **VERIFIED:** current production counts include 2 leads, 2 activity rows, 3 inspection sessions, 1 photo, 3 tasks, and zero appointments/receptionist events at the time of the count.
- **UNKNOWN:** whether existing rows would pass PR #70's proposed composite workspace checks if those constraints were later introduced; no mutation or simulated constraint validation was performed.

---

## 7. UNVERIFIED ITEMS

1. **NOT VERIFIED:** The operator, deployment pipeline, or exact SQL event that applied `20261002182249 / receptionist_workspace_integrity`.
2. **NOT VERIFIED:** Whether any untracked/manual production SQL exists that is not reflected in `supabase_migrations.schema_migrations`.
3. **NOT VERIFIED:** Complete function-body audit for every SECURITY DEFINER function using `search_path=public`.
4. **NOT VERIFIED:** Runtime cross-workspace attempts under separate authenticated JWT identities.
5. **NOT VERIFIED:** Whether every row satisfies the proposed PR #70 composite workspace invariants without running a dedicated read-only validation query over all relevant rows. (The expected constraints themselves are absent.)
6. **NOT VERIFIED:** Whether the PR #70 and PR #72 branches were intended to be merged together, replaced, or kept as separate migrations.
7. **NOT VERIFIED:** Exact production definitions for tables referenced only by PR #70's 044–047 files because those PR migrations are not in the production ledger and their expected object names were absent.

---

## 8. EXACT EVIDENCE FOR EACH FINDING

### Production queries executed

1. Supabase project listing for project identity.
2. Supabase migration list for the complete timestamp/name ledger.
3. Supabase table listing with `verbose=true` for columns, RLS, keys, and foreign keys.
4. `supabase_migrations.schema_migrations` query shown in §2.1.
5. `pg_proc` query with `pg_get_functiondef()` shown in §3.2.
6. `pg_trigger` query returning trigger definitions, trigger functions, security-definer flags, and function configs.
7. `pg_policies` query returning all scoped table policies and predicates.
8. `information_schema.columns` query returning nullability and defaults for scoped columns.
9. Catalog query for PR #70 expected function/trigger/constraint names; returned `[]`.
10. Catalog query for RLS-relevant constraints and ACLs.
11. Read-only count query over the core tables.

All SQL queries included an explicit `LIMIT` as required by the read-only database tool contract. No DDL, DML, migration, policy, trigger, function replacement, or data mutation was issued.

### Repository/PR sources

- Current checkout: `/home/ubuntu/roof-os`, `main`, HEAD `f299810`.
- Current source migrations: `supabase/migrations/039_crm_missing_spokes.sql` through `supabase/migrations/042_golden_report_review_controls.sql`.
- PR #70: `fix/activity-continuity-20261002`, open, unmerged; diff contains 043–047 inspection/ownership migrations.
- PR #72: `backend/production-hardening-20261002`, open, unmerged; source branch contains `supabase/migrations/043_receptionist_workspace_integrity.sql`.
- PR #73: open documentation PR; does not establish production database state.

---

## 9. SAFE RECONCILIATION PLAN

This is a plan only. It was not executed.

1. **Freeze the evidence baseline.** Preserve the production ledger output, catalog outputs, current-main commit, PR #70 diff, and PR #72 migration source.
2. **Resolve migration identity before merging anything.** Do not use numeric `043` as an identity. Assign a unique timestamped migration version and an unambiguous name for any future migration.
3. **Treat PR #72's receptionist state as already live.** Do not replay its `CREATE OR REPLACE FUNCTION` or `ALTER COLUMN` blindly. First decide whether to add a durable repository migration representing the already-live state, or to map the existing ledger entry to source through the deployment system.
4. **Review PR #70 independently.** Its functions/triggers/composite constraints are not live. Validate its expected row invariants with read-only queries before considering deployment.
5. **Resolve PR #70/#72 ordering.** If both are approved, define an explicit order and migration names. Avoid two migrations with the same numeric prefix and avoid treating two different `043` files as interchangeable.
6. **Add tests before deployment.** Include catalog assertions for function signature/ACL/search path, trigger existence, RLS policy predicates, and cross-workspace rejection cases.
7. **Stage outside production first.** Apply the chosen migration set to a disposable/staging database and inspect the resulting catalog. Only then use the normal protected production deployment process.
8. **Post-deployment verify read-only.** Re-run the exact ledger, function, trigger, constraint, policy, grant, and cross-workspace checks. Do not rely on filename or PR status as deployment proof.

---

## 10. NEXT VERIFICATION REQUIRED

Before any repair or migration recommendation is finalized:

1. Obtain the deployment-system record that maps `20261002182249` to PR #72's source migration.
2. Run a read-only row-invariant query for every `lead_activity`, `lead_status_history`, and `lead` workspace relationship targeted by PR #70.
3. Retrieve and line-review all live SECURITY DEFINER bodies used by RLS (`is_workspace_member`, `is_workspace_admin`, and related helpers), including dynamic SQL and object qualification.
4. Execute controlled cross-workspace authorization tests in a non-production environment using two workspace identities.
5. Decide whether PR #70's activity automation is desired. If yes, produce a new uniquely versioned migration rather than assuming PR #70's `043` can be applied as-is.

**Final status:** Production state is established for the inspected scope. No production repair was performed. The primary actionable discrepancy is that production contains PR #72's receptionist hardening while current `main` does not, and PR #70's inspection-activity atomicity is neither in current `main` nor in production.
