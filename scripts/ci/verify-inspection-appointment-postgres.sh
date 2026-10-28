#!/usr/bin/env bash
set -euo pipefail
# Disposable GitHub Actions PostgreSQL only. Never a production endpoint.
test "$PGHOST" = 127.0.0.1 || { echo 'Refusing a nonlocal DB host' >&2; exit 1; }
test "$PGDATABASE" = roofos_authority_ci || { echo 'Refusing a non-test database' >&2; exit 1; }
test "$PGPORT" = 5432 || { echo 'Refusing unexpected port' >&2; exit 1; }
command -v docker >/dev/null

# Dedicated database: the estimate suite leaves a minimal public.leads table.
INSPECTION_DB=roofos_inspection_ci

psql_db() {
  local db="$1"; shift
  docker run --rm --network host --user "$(id -u):$(id -g)" \
    -e PGPASSWORD="$PGPASSWORD" \
    -v "$PWD:/work:ro" -w /work postgres:16-alpine \
    psql -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -p 5432 -U postgres -d "$db" "$@"
}

if [ -z "$(psql_db postgres -tAc "select 1 from pg_database where datname='$INSPECTION_DB'")" ]; then
  psql_db postgres -c "create database $INSPECTION_DB"
fi

psql_db "$INSPECTION_DB" -f scripts/ci/inspection-appointment-baseline.sql
psql_db "$INSPECTION_DB" -f supabase/migrations/062_inspection_appointment_gate.sql
psql_db "$INSPECTION_DB" -f scripts/ci/inspection-appointment-assertions.sql

echo 'INSPECTION APPOINTMENT MIGRATION 062: isolated SQL-role/RLS/trigger tests passed. Supabase Auth/Storage remains untested.'
echo '**Inspection appointment migration 062: real isolated PostgreSQL trigger/RLS tests PASSED. Supabase Auth/Storage not exercised.**' >> "$GITHUB_STEP_SUMMARY"
