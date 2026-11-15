#!/usr/bin/env bash
set -euo pipefail
# Only a disposable PostgreSQL test database on loopback is permitted.
test "${PGHOST:-}" = 127.0.0.1 || { echo 'Refusing nonlocal host' >&2; exit 1; }
test "${PGDATABASE:-}" = roofos_authority_ci || { echo 'Refusing non-test database' >&2; exit 1; }
test "${PGPORT:-}" = 5432 || { echo 'Refusing unexpected port' >&2; exit 1; }
DB="roofos_bailey_ci_${GITHUB_RUN_ID:-local}_${GITHUB_RUN_ATTEMPT:-1}_$$"
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
    echo 'Need Docker or psql for isolated BAILEY agent setup checks' >&2
    return 127
  fi
}
cleanup() { psql_db postgres -c "drop database if exists \"$DB\"" >/dev/null || true; }
trap cleanup EXIT
psql_db postgres -c "create database \"$DB\""
psql_db "$DB" -f scripts/ci/onboarding-profile-baseline.sql
psql_db "$DB" -f supabase/migrations/094_workspace_bailey_agent_setup.sql
psql_db "$DB" -f scripts/ci/bailey-agent-setup-assertions.sql
echo 'BAILEY AGENT SETUP 094: isolated PostgreSQL RLS and validation checks passed.'
