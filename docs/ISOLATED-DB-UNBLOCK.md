# Roof OS: isolated PostgreSQL evidence gate

This repository now runs a **real PostgreSQL 16** service in the already required
`migration-safety` GitHub Actions job. The test runs on GitHub's Ubuntu runner,
never on the low-memory Chromebook. It uses Docker on the runner only; no local
apt, dpkg lock, `initdb`, Docker daemon or local `psql` is required.

The runner uses a disposable `roofos_authority_ci` database on localhost with
synthetic credentials and no production/staging secrets. It executes **actual**
repo migrations 007 and 058 on a deliberately minimal Supabase-shaped SQL baseline.

When the feature branch contains `supabase/migrations/059_*.sql`, it applies
the **actual migration** and exercises synthetic workspace owner/member SQL
authorization: direct approval denial, RPC approval denial, cross-workspace
denial, owner approval, approved totals and immutable approval metadata.

The `059` tests are **not run until the actual migration is pushed**. When 059
is absent, green migration-safety CI proves disposable PostgreSQL is working
and 007/058 executed; it **does NOT verify migration 059**. A failing 059 test
fails the existing required `migration-safety` job and blocks regular merges.
If 059 depends on later prerequisite objects, extend the synthetic baseline
without modifying shipped/applied migrations or weakening negative assertions.

This is a SQL-role fixture, *not* a full Supabase Auth / GoTrue session,
Storage, live two-user RLS, deployed API, Docling runtime, CapOut provider or
production migration check. Those remain separate evidence gates.

## Use

1. OpenCode publishes its local `feat/estimate-approval-authority` branch,
   including migration 059. No production deployment or SQL.
2. GitHub runs the existing `migration-safety` required check with PostgreSQL.
3. A green check accompanied by explicit **059 test passed** in the job logs
   is the isolated SQL authorization evidence. Review the assertions.
4. Run separate disposable real Supabase Auth + Storage tests before commercial
   release; and obtain separate authorization for any production migration.

The Docling worker needs a separate runner/host but is not a prerequisite for
the estimate security migration test. `CAPOUT_API_KEY` is optional and not used.
Owner Break Glass is unchanged; God Mode and Agent 4 remain disabled.
