#!/usr/bin/env bash
set -euo pipefail
# Disposable loopback PostgreSQL only. Never a production endpoint.
test "${PGHOST:-}" = 127.0.0.1 || { echo 'Refusing a nonlocal DB host' >&2; exit 1; }
test "${PGDATABASE:-}" = roofos_authority_ci || { echo 'Refusing a non-test database' >&2; exit 1; }
test "${PGPORT:-}" = 5432 || { echo 'Refusing unexpected port' >&2; exit 1; }
DB="roofos_onboarding_ci_${GITHUB_RUN_ID:-local}_${GITHUB_RUN_ATTEMPT:-1}_$$"
psql_db() {
  local db="$1"; shift
  if command -v docker >/dev/null 2>&1; then
    docker run --rm --network host --user "$(id -u):$(id -g)" \
      -e PGPASSWORD="${PGPASSWORD:?Set PGPASSWORD for disposable PostgreSQL}" \
      -v "$PWD:/work:ro" -w /work postgres:16-alpine \
      psql -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -p 5432 -U postgres -d "$db" "$@"
  elif command -v psql >/dev/null 2>&1; then
    PGPASSWORD="${PGPASSWORD:?Set PGPASSWORD for disposable PostgreSQL}" \
      psql -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -p 5432 -U postgres -d "$db" "$@"
  else
    echo 'Need Docker or psql to run isolated PostgreSQL onboarding checks.' >&2
    return 127
  fi
}
cleanup() {
  psql_db postgres -c "drop database if exists \"$DB\"" >/dev/null || true
}
trap cleanup EXIT
psql_db postgres -c "create database \"$DB\""
psql_db "$DB" -f scripts/ci/onboarding-profile-baseline.sql
psql_db "$DB" -f supabase/migrations/092_workspace_onboarding_profiles.sql

# Seed a v1 row that passed migration 092 but must be downgraded by migration 093:
# it is marked completed without the explicit first-goal answer.
psql_db "$DB" -c "insert into public.workspace_onboarding_profiles (
  workspace_id, profile, status, schema_version, updated_by, completed_at
) values (
  '22222222-2222-4222-8222-222222222222',
  '{\"companyType\":\"residential\"}'::jsonb,
  'completed',
  1,
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  now()
)"

psql_db "$DB" -f supabase/migrations/093_workspace_onboarding_profile_v2.sql
psql_db "$DB" -f scripts/ci/onboarding-profile-assertions.sql

echo 'ONBOARDING PROFILE MIGRATIONS 092+093: isolated PostgreSQL RLS, workspace-isolation, and v2 profile-contract tests passed. Supabase Auth/Storage integration remains untested.'
if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  echo '**Onboarding profile migrations 092+093: isolated PostgreSQL RLS/workspace-isolation and v2 profile-contract tests PASSED. Supabase Auth/Storage integration not exercised.**' >> "$GITHUB_STEP_SUMMARY"
fi
