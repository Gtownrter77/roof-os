#!/usr/bin/env bash
set -euo pipefail
# Disposable GitHub Actions PostgreSQL only. Never a production endpoint.
test "${PGHOST:-}" = 127.0.0.1 || { echo 'Refusing a nonlocal DB host' >&2; exit 1; }
test "${PGDATABASE:-}" = roofos_authority_ci || { echo 'Refusing a non-test database' >&2; exit 1; }
test "${PGPORT:-}" = 5432 || { echo 'Refusing unexpected port' >&2; exit 1; }
command -v docker >/dev/null

DB=roofos_onboarding_ci
psql_db() {
  local db="$1"; shift
  docker run --rm --network host --user "$(id -u):$(id -g)" \
    -e PGPASSWORD="$PGPASSWORD" \
    -v "$PWD:/work:ro" -w /work postgres:16-alpine \
    psql -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -p 5432 -U postgres -d "$db" "$@"
}
if [ -z "$(psql_db postgres -tAc "select 1 from pg_database where datname='$DB'")" ]; then
  psql_db postgres -c "create database $DB"
fi
psql_db "$DB" -f scripts/ci/onboarding-profile-baseline.sql
psql_db "$DB" -f supabase/migrations/092_workspace_onboarding_profiles.sql
psql_db "$DB" -c "grant select,insert,update on public.workspace_onboarding_profiles to authenticated"
psql_db "$DB" -f scripts/ci/onboarding-profile-assertions.sql

echo 'ONBOARDING PROFILE MIGRATION 092: isolated PostgreSQL RLS and workspace-isolation tests passed. Supabase Auth/Storage integration remains untested.'
echo '**Onboarding profile migration 092: isolated PostgreSQL RLS/workspace-isolation tests PASSED. Supabase Auth/Storage integration not exercised.**' >> "$GITHUB_STEP_SUMMARY"
