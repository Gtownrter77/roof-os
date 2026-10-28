#!/usr/bin/env bash
set -euo pipefail
# Disposable GitHub Actions PostgreSQL only. Never a production endpoint.
test "$PGHOST" = 127.0.0.1 || { echo 'Refusing a nonlocal DB host' >&2; exit 1; }
test "$PGDATABASE" = roofos_authority_ci || { echo 'Refusing a non-test database' >&2; exit 1; }
test "$PGPORT" = 5432 || { echo 'Refusing unexpected port' >&2; exit 1; }
command -v docker >/dev/null

sql() {
  docker run --rm --network host --user "$(id -u):$(id -g)" \
    -e PGPASSWORD="$PGPASSWORD" \
    -v "$PWD:/work:ro" -w /work postgres:16-alpine \
    psql -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -p 5432 -U postgres \
      -d roofos_authority_ci "$@"
}

# The estimate-authority suite may already have created the synthetic baseline
# in this disposable database. Create it only when absent.
if [ -z "$(sql -tAc "select to_regclass('public.workspaces')")" ]; then
  sql -f scripts/ci/estimate-authority-baseline.sql
fi
sql -f supabase/migrations/060_supplement_specialist_agent5.sql
sql -f scripts/ci/supplement-specialist-assertions.sql
echo 'AGENT 5 MIGRATION 060: isolated SQL-role/RLS/trigger tests passed. Supabase Auth/Storage remains untested.'
echo '**Agent 5 migration 060: real isolated PostgreSQL RLS/trigger tests PASSED. Supabase Auth/Storage not exercised.**' >> "$GITHUB_STEP_SUMMARY"
