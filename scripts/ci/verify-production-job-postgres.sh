#!/usr/bin/env bash
set -euo pipefail
# Disposable GitHub Actions PostgreSQL only. Never a production endpoint.
test "$PGHOST" = 127.0.0.1 || { echo 'Refusing a nonlocal DB host' >&2; exit 1; }
test "$PGDATABASE" = roofos_authority_ci || { echo 'Refusing a non-test database' >&2; exit 1; }
test "$PGPORT" = 5432 || { echo 'Refusing unexpected port' >&2; exit 1; }
command -v docker >/dev/null

# Dedicated database: earlier suites leave their own tables and roles behind.
JOB_DB=roofos_job_ci

psql_db() {
  local db="$1"; shift
  docker run --rm --network host --user "$(id -u):$(id -g)" \
    -e PGPASSWORD="$PGPASSWORD" \
    -v "$PWD:/work:ro" -w /work postgres:16-alpine \
    psql -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -p 5432 -U postgres -d "$db" "$@"
}

if [ -z "$(psql_db postgres -tAc "select 1 from pg_database where datname='$JOB_DB'")" ]; then
  psql_db postgres -c "create database $JOB_DB"
fi

psql_db "$JOB_DB" -f scripts/ci/production-job-baseline.sql
psql_db "$JOB_DB" -f supabase/migrations/063_estimate_acceptance_deposit.sql
psql_db "$JOB_DB" -f supabase/migrations/064_production_job_handoff.sql
# Tables created by the migrations need the same test role grants the baseline gave.
psql_db "$JOB_DB" -c "grant select,insert,update,delete on all tables in schema public to authenticated"
psql_db "$JOB_DB" -f scripts/ci/production-job-assertions.sql
psql_db "$JOB_DB" -f supabase/migrations/067_production_job_schedule.sql
psql_db "$JOB_DB" -c "grant select,insert,update,delete on all tables in schema public to authenticated"
psql_db "$JOB_DB" -f scripts/ci/production-job-schedule-assertions.sql
psql_db "$JOB_DB" -f supabase/migrations/068_production_job_readiness.sql
psql_db "$JOB_DB" -c "grant select,insert,update,delete on all tables in schema public to authenticated"
psql_db "$JOB_DB" -f scripts/ci/production-job-readiness-assertions.sql
psql_db "$JOB_DB" -f supabase/migrations/069_field_work_change_orders.sql
psql_db "$JOB_DB" -c "grant select,insert,update,delete on all tables in schema public to authenticated"
psql_db "$JOB_DB" -f scripts/ci/production-job-fieldwork-assertions.sql
psql_db "$JOB_DB" -f supabase/migrations/070_qc_punch_closeout.sql
psql_db "$JOB_DB" -c "grant select,insert,update,delete on all tables in schema public to authenticated"
psql_db "$JOB_DB" -f scripts/ci/production-job-qc-assertions.sql

echo 'PRODUCTION JOB SCHEDULE, READINESS, FIELD, CHANGE-ORDER AND QC MIGRATIONS 067-070: isolated SQL-role/RLS/trigger tests passed. Supabase Auth/Storage remains untested.'
echo '**Production job migrations 067-070: real isolated PostgreSQL trigger/RLS tests PASSED. Supabase Auth/Storage not exercised.**' >> "$GITHUB_STEP_SUMMARY"
