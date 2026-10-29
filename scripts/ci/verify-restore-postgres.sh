#!/usr/bin/env bash
set -euo pipefail
# Isolated backup/restore rehearsal on the disposable GitHub Actions
# PostgreSQL cluster. This is NOT a production or staging restore and it does
# not touch any Supabase project.
test "$PGHOST" = 127.0.0.1 || { echo 'Refusing a nonlocal DB host' >&2; exit 1; }
test "$PGDATABASE" = roofos_authority_ci || { echo 'Refusing a non-test database' >&2; exit 1; }
test "$PGPORT" = 5432 || { echo 'Refusing unexpected port' >&2; exit 1; }
command -v docker >/dev/null

SRC_DB=roofos_job_ci
DST_DB=roofos_restore_ci
WORK_DIR=$(mktemp -d "${TMPDIR:-/tmp}/roofos-restore.XXXXXX")
trap 'rm -rf "$WORK_DIR"' EXIT

psql_db() {
  local db="$1"; shift
  docker run --rm -i --network host --user "$(id -u):$(id -g)" \
    -e PGPASSWORD="$PGPASSWORD" \
    -v "$PWD:/work:ro" -w /work postgres:16-alpine \
    psql -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -p 5432 -U postgres -d "$db" "$@"
}

tool() {
  docker run --rm --network host --user "$(id -u):$(id -g)" \
    -e PGPASSWORD="$PGPASSWORD" \
    -v "$WORK_DIR:/dump" -w /dump postgres:16-alpine "$@"
}

if [ -z "$(psql_db postgres -tAc "select 1 from pg_database where datname='$SRC_DB'")" ]; then
  echo "Source test database $SRC_DB does not exist; run the production job suite first" >&2
  exit 1
fi

echo 'Creating a custom-format dump of the disposable test database'
tool pg_dump -h 127.0.0.1 -p 5432 -U postgres -d "$SRC_DB" \
  --format=custom --no-owner --no-privileges --schema=public --file=/dump/job.dump
test -s "$WORK_DIR/job.dump"

psql_db postgres -c "drop database if exists $DST_DB"
psql_db postgres -c "create database $DST_DB"

# The dump is public-schema only. Recreate the narrow auth surface the
# foreign keys and auth.uid() defaults reference, exactly as the baseline does,
# and seed its synthetic rows before the public data is restored.
psql_db "$DST_DB" -c "create schema if not exists auth"
psql_db "$DST_DB" -c "create table if not exists auth.users(id uuid primary key)"
psql_db "$DST_DB" -c "create or replace function auth.uid() returns uuid language sql stable as \$\$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid \$\$"

echo 'Copying the synthetic auth rows the public foreign keys depend on'
tool pg_dump -h 127.0.0.1 -p 5432 -U postgres -d "$SRC_DB" \
  --format=custom --no-owner --no-privileges --schema=auth --data-only \
  --file=/dump/auth.dump
tool pg_restore -h 127.0.0.1 -p 5432 -U postgres -d "$DST_DB" \
  --no-owner --no-privileges --exit-on-error --data-only /dump/auth.dump

# The target database already owns the default public schema. The dump carries
# its own CREATE SCHEMA public entry, so filter that one TOC line out instead of
# weakening --exit-on-error or dropping the live schema.
tool pg_restore -l /dump/job.dump > "$WORK_DIR/toc.list"
grep -v 'SCHEMA - public' "$WORK_DIR/toc.list" > "$WORK_DIR/toc.filtered"
test -s "$WORK_DIR/toc.filtered"

echo 'Restoring into the isolated rehearsal database'
tool pg_restore -h 127.0.0.1 -p 5432 -U postgres -d "$DST_DB" \
  --no-owner --no-privileges --exit-on-error --use-list=/dump/toc.filtered /dump/job.dump

compare_count() {
  local table="$1"
  local src dst
  src=$(psql_db "$SRC_DB" -tAc "select count(*) from public.$table")
  dst=$(psql_db "$DST_DB" -tAc "select count(*) from public.$table")
  if [ "$src" != "$dst" ]; then
    echo "RESTORE FAILURE: $table has $src rows at source and $dst after restore" >&2
    exit 1
  fi
  echo "restored $table rows: $dst"
}

for table in \
  production_jobs \
  production_job_assignments \
  production_job_materials \
  production_job_readiness \
  production_job_updates \
  production_job_change_orders \
  production_job_punch_items \
  production_job_closeouts \
  production_invoices \
  production_invoice_payments \
  warranties \
  roof_passports
do
  compare_count "$table"
done

src_auth=$(psql_db "$SRC_DB" -tAc "select count(*) from auth.users")
dst_auth=$(psql_db "$DST_DB" -tAc "select count(*) from auth.users")
if [ "$src_auth" != "$dst_auth" ]; then
  echo "RESTORE FAILURE: auth.users has $src_auth synthetic rows at source and $dst_auth after restore" >&2
  exit 1
fi
echo "restored synthetic auth.users rows: $dst_auth"

# The rehearsed lifecycle evidence must survive the round trip, not just table counts.
psql_db "$DST_DB" -tAc "select 1" >/dev/null
psql_db "$DST_DB" -v ON_ERROR_STOP=1 <<'SQL'
do $$
declare v_invoice public.production_invoices%rowtype;
declare v_job public.production_jobs%rowtype;
declare v_payment public.production_invoice_payments%rowtype;
declare v_warranty public.warranties%rowtype;
declare v_passport public.roof_passports%rowtype;
begin
  if not exists (select 1 from public.production_jobs
                  where id='1e000000-0000-4000-8000-000000000001' and status='completed') then
    raise exception 'RESTORE FAILURE: the completed lifecycle job is missing';
  end if;
  select * into v_job from public.production_jobs where id='1e000000-0000-4000-8000-000000000001';
  if v_job.accepted_total <> 1100 or v_job.scope_item_count <> 2 then
    raise exception 'RESTORE FAILURE: the handoff snapshot changed in restore';
  end if;

  select * into v_invoice from public.production_invoices where id='25000000-0000-4000-8000-000000000001';
  if v_invoice.status <> 'void' or v_invoice.total <> 1150 or v_invoice.balance_due <> 1150 then
    raise exception 'RESTORE FAILURE: the invoice evidence changed in restore (% / % / %)',
      v_invoice.status,v_invoice.total,v_invoice.balance_due;
  end if;

  select * into v_payment from public.production_invoice_payments where id='26000000-0000-4000-8000-000000000001';
  if v_payment.status <> 'reversed' or v_payment.amount_cents <> 115000 then
    raise exception 'RESTORE FAILURE: the payment evidence changed in restore (% / %)',
      v_payment.status,v_payment.amount_cents;
  end if;

  select * into v_warranty from public.warranties where job_id='1e000000-0000-4000-8000-000000000001';
  if v_warranty.status <> 'revoked' or v_warranty.expires_at <= v_warranty.issued_at then
    raise exception 'RESTORE FAILURE: the warranty evidence changed in restore';
  end if;

  select * into v_passport from public.roof_passports where id='27000000-0000-4000-8000-000000000001';
  if v_passport.status <> 'revoked' or v_passport.revoked_by is null then
    raise exception 'RESTORE FAILURE: the Roof Passport evidence changed in restore';
  end if;

  if (select count(*) from pg_tables
       where schemaname='public' and rowsecurity
         and tablename in ('production_invoices','production_invoice_payments','warranties','roof_passports')
     ) <> 4 then
    raise exception 'RESTORE FAILURE: row level security was lost in restore';
  end if;

  if not exists (select 1 from pg_trigger
                  where not tgisinternal
                    and tgname='enforce_production_invoice_payment') then
    raise exception 'RESTORE FAILURE: the payment guard trigger was lost in restore';
  end if;
end $$;
SQL

echo 'Restore rehearsal: PASS (isolated custom-format dump/restore, row counts, lifecycle evidence, RLS and guard triggers intact). Production and staging restores remain unverified.'
