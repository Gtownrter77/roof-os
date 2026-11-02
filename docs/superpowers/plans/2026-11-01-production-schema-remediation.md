# Production Schema Reconciliation Implementation Plan

> **For agentic workers:** Use the approved autonomous execution method in this conversation. Complete each task with a test and a fresh verification result before continuing.

**Goal:** Bring the live Supabase schema into safe parity with the current ROOF/OS application while preserving deployed legacy data and authority boundaries.

**Architecture:** Reconcile the production migration ledger against the live schema and exact repository migration SQL. Apply only unapplied, preflighted migrations in dependency order. Keep the legacy warranty and Roof Passport contracts intact until a forward-compatible application/schema bridge is tested.

**Tech Stack:** Supabase Postgres, SQL migrations, Next.js route handlers, GitHub Actions, Node.js contract tests.

**Spec:** Current source at `b74d23431aa4affcf512710635197bc0e1923256`, production project `xksumagfbegdlapwysps`, live migration ledger and schema snapshot read on 2026-11-01.

## Global Constraints

- Never replay, rename, or renumber an applied migration.
- Treat the production timestamp ledger as authoritative; repo numeric prefixes are not remote migration versions.
- Preserve existing `roof_passports` and `warranties` tables and their currently shipped app fields.
- Do not apply migrations 073–074 until their legacy schema compatibility is proven by tests and an explicit forward migration.
- All public-schema tables with user data require RLS and workspace isolation.
- No AI observation may become a certified measurement, estimate, claim, code determination, or customer-facing promise.
- Customer communication, payments, approvals, job creation, and warranty issuance remain human-authorized operations.
- Production migrations must be applied in small ordered batches with post-apply schema/function/policy verification.

## Review Focus

- An existing table has the same name but a different column contract: keep legacy fields and add only tested nullable/derived fields.
- Production has manually applied columns but a stale function body: verify function definition, trigger definition, and behavior rather than column presence alone.
- A recorded migration uses a timestamp/name alias: skip replay when its schema effect is proven.
- A SECURITY DEFINER function has a broad EXECUTE grant or mutable search path: constrain it without breaking trigger execution.
- A feature endpoint exists in source but required database objects are missing: return a truthful disabled/unavailable state until migration and runtime tests pass.

---

### Task 1: Capture a machine-checkable production migration contract

**Files:**
- Create: `scripts/production-schema-contract-test.mjs`
- Modify: `package.json`
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Input: repository migration SQL and route/worker source.
- Output: deterministic PASS/FAIL assertions for migration dependencies, protected legacy table shape, and release-gate documentation markers.

- [ ] Add a failing contract test that detects the current mismatch: migration 057 feature columns exist in source, while its trigger body is not yet guaranteed to honor `enable_auto_followup_tasks`.
- [ ] Run the test in CI or local Node and capture the expected RED result.
- [ ] Implement assertions for migration 057–074 presence/order, duplicate-name-safe ledger instructions, 073/074 legacy incompatibility guard, and DB-dependent feature routes that must be schema-gated.
- [ ] Add `test:production-schema-contract` to the root package scripts and required web CI job.
- [ ] Verify the new test passes, then run the full web CI suite.

### Task 2: Reconcile the safely additive production migrations

**Files:**
- Modify: `CURRENT-STATE.md`
- Modify: `MIGRATION-ORDER.md`
- Modify: `HANDOFF.md`
- Source of truth: `supabase/migrations/057_workspace_feature_flags.sql`, `059_estimate_approval_admin_guard.sql` through `072_production_invoice_payment.sql`

**Interfaces:**
- Apply order: 057, skip 058 when its exact effect is verified under production ledger name `atomic_estimate_line_item_replacement`, then 059–072 in numeric order.
- No app route is considered live until its table/function and RLS policy are verified in production.

- [ ] Run read-only preflight checks for table/column dependencies, duplicate leads, existing data, RLS, policies, trigger names, and function signatures.
- [ ] Run migration-safety and authority contract tests against a clean PostgreSQL 16 database using the exact source files.
- [ ] Apply 057 using Supabase's protected migration action; verify the full `create_default_lead_followup()` definition, trigger, feature-flag columns and ACL.
- [ ] Apply 059–062 in order; after each migration verify intended policies, functions, triggers, row counts and cross-workspace boundaries.
- [ ] Apply 063–066 in order; verify the acceptance/deposit ledger is append-only and workspace-scoped, and that pre-existing draft estimates are unchanged.
- [ ] Apply 067–072 in order; verify job, assignment, material, readiness, field-work, QC, invoice and payment tables, RLS and lifecycle guards.
- [ ] Re-run the read-only schema contract and production advisors; record warnings without suppressing or relabeling them.
- [ ] Verify Vercel deployed code does not report missing-relation errors on the newly backed routes.

### Task 3: Keep warranty and passport schema evolution backward-compatible

**Files:**
- Modify: `supabase/migrations/073_warranty_passport.sql`
- Modify: `supabase/migrations/074_payment_warranty_guards.sql`
- Create: a new migration with a unique prefix greater than 074 using the project's migration workflow
- Modify: warranty and Roof Passport application routes/pages only after contracts are defined.
- Tests: warranty lifecycle, passport lifecycle, public-share lifecycle, legacy field compatibility.

**Interfaces:**
- Preserve existing legacy columns: `warranties.registration_status`, `passport_id`, `lead_id`, and `roof_passports.public_token`, `public_shared`, `lead_id`, `status`.
- Do not silently change legacy enum/check semantics (`draft/active/transferred/archived`) to the new lifecycle names (`pending/generated/issued/revoked`).
- New production-job lifecycle is isolated until a real production job exists; no synthetic job is created for a legacy passport.

- [ ] Write failing migration/contract tests that run against the real legacy table definitions and confirm existing warranty/passport flows stay valid.
- [ ] Rework 073/074 to add a compatible lifecycle representation without replacing or assuming a new table shape.
- [ ] Test both legacy records and production-job-linked records, including revoke, expiry, and immutability rules.
- [ ] Apply only after schema migration and application tests pass in staging.
- [ ] Verify production legacy table columns and policy behavior after apply.

### Task 4: End-to-end release verification

- [ ] Run authenticated owner/member checks in two workspaces for estimate approval, supplement review, job handoff, scheduling, change orders, QC, invoice issue, payment record, and warranty/passport operations.
- [ ] Use disposable records only and remove them after verifying rollback/cleanup.
- [ ] Confirm no external messages, payment charges, warranty registrations, or insurer submissions are sent by tests.
- [ ] Update the release evidence and handoff with exact applied migration names, deployment SHA, test run IDs, and explicit unresolved gates.
