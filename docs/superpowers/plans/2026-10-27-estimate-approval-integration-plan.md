# Isolated Integration-Test Plan — Estimate Approval Auth (059)

No production connection. No local PostgreSQL/Docker install.

## Source contracts (verified locally and in CI)
- Migration 059 source assertions (new function, dropped 007 policy, new policies, trigger, pinned `search_path`).
- API PUT/POST source assertions (admin RPC check present, 403 message present).
- Regression `scripts/estimate-approval-authority-test.mjs`: PASS.
- Cross-workspace isolation: `.eq('workspace_id', workspaceId)` in both routes (verified by source read).

## Real PostgreSQL verification (GitHub-hosted disposable database)
The `migration-safety` job in `.github/workflows/ci.yml` starts a disposable `postgres:16` service and runs
`scripts/ci/verify-estimate-authority-postgres.sh`:

1. Apply the synthetic Supabase baseline, migration 007 and 058.
2. Apply the actual `supabase/migrations/059_*.sql` file from the branch.
3. Run `scripts/ci/estimate-authority-assertions.sql`:
   - Direct INSERT `estimates` with `status = 'approved'`, non-admin creator → rejected by `estimates_insert` RLS.
   - Direct UPDATE to `approved`, non-admin member → rejected by `estimates_update_member` + trigger.
   - Direct UPDATE of `approved_by` / `approved_at` on a draft by a member → rejected by the metadata trigger.
   - RPC `replace_estimate_line_items` with `p_status = 'approved'`, non-admin caller → raises.
   - RPC approval by the workspace owner → succeeds and writes totals/approval metadata.
   - Approved totals and approval metadata are immutable; line items cannot be inserted afterwards.
   - Cross-workspace RPC approval by a non-member → rejected.
   - Member cannot create a pre-approved estimate.

## Evidence boundary
- This is real PostgreSQL/RLS/SQL-role execution, **not** a Supabase Auth, Storage, API or production check.
- Auth/Storage integration and production migration remain separate, unauthorized steps.
- Report pass/fail from the actual job log; never infer database behaviour from SQL text alone.
