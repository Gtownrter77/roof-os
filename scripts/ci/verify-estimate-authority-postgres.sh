#!/usr/bin/env bash
set -euo pipefail
# Deliberately accepts ONLY GitHub Actions' localhost disposable Postgres service.
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

sql -f scripts/ci/estimate-authority-baseline.sql
sql -f supabase/migrations/007_estimates_price_books.sql
sql -f supabase/migrations/058_atomic_estimate_line_item_replacement.sql

count=0
file=''
for migration in supabase/migrations/059_*.sql; do
  if [[ ! -f "$migration" ]]; then continue; fi
  count=$((count + 1))
  file="$migration"
done

if [[ "$count" == 0 ]]; then
  echo 'PASS: isolated PostgreSQL 16 initialized; actual migrations 007 and 058 executed.'
  echo 'MIGRATION 059: NOT VERIFIED because it has not been pushed to this branch.'
  echo '**PostgreSQL infrastructure PASS; migration 059 NOT VERIFIED (file missing).**' >> "$GITHUB_STEP_SUMMARY"
  exit 0
fi
test "$count" == 1 || { echo "Found $count migration 059 files; expected exactly one." >&2; exit 1; }
echo "Applying migration $file in disposable PostgreSQL"
sql -f "$file"
sql -f scripts/ci/estimate-authority-assertions.sql
echo 'MIGRATION 059: isolated SQL-role/RLS/trigger/RPC tests passed. Full Supabase Auth/Storage remains untested.'
echo '**Migration 059: real isolated PostgreSQL SQL-role authorization tests PASSED. Supabase Auth/Storage not exercised.**' >> "$GITHUB_STEP_SUMMARY"
