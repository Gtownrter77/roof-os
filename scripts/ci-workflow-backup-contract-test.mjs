import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const workflow = readFileSync('.github/workflows/free-evidence.yml', 'utf8')
const step = workflow.split('      - name: Verify backup and restore rehearsal')[1]?.split('      - name:')[0] ?? ''
assert.ok(step, 'backup rehearsal step must exist')

for (const check of [
  'DB_CONTAINER="$(docker ps --format \'{{.Names}} {{.Image}}\' | awk \'/supabase\\/postgres:/{print $1; exit}\')"',
  'test -n "$DB_CONTAINER"',
  'docker exec "$DB_CONTAINER" pg_dump -U postgres --format=custom --file /tmp/roof-os-backup.dump postgres',
  'docker cp "$DB_CONTAINER:/tmp/roof-os-backup.dump" "$BACKUP_FILE"',
  'psql "$DB_URL" -v ON_ERROR_STOP=1 -c \'drop database if exists roof_os_restore\' -c \'create database roof_os_restore\'',
  'restore_url="${DB_URL%/postgres}/roof_os_restore"',
  'docker cp "$BACKUP_FILE" "$DB_CONTAINER:/tmp/roof-os-restore.dump"',
  'docker exec "$DB_CONTAINER" pg_restore -U postgres --no-owner --dbname roof_os_restore /tmp/roof-os-restore.dump',
  'source_tables="$(psql "$DB_URL" -tAc "select count(*)::text from pg_tables where schemaname = \'public\'" | tr -d \'\\r\')"',
  'restored_tables="$(psql "$restore_url" -tAc "select count(*)::text from pg_tables where schemaname = \'public\'" | tr -d \'\\r\')"',
  'test "$source_tables" -gt 0',
  'test "$restored_tables" = "$source_tables"',
  'source_data_hash="$(data_hash "$DB_URL")"',
  'restored_data_hash="$(data_hash "$restore_url")"',
  'test "$source_data_hash" = "$restored_data_hash"',
]) {
  assert.ok(step.includes(check), `backup step must verify: ${check}`)
}
assert.ok(
  !step.includes('pg_dump "$DB_URL"'),
  'the runner pg_dump is PG16 and cannot dump the PG17 Supabase server',
)
assert.ok(
  !step.includes('--schema public --file "$BACKUP_FILE"'),
  'a public-only backup leaves dangling auth references',
)

console.log('ci-workflow-backup-contract-test: PASS (server-matched dump/restore with psql data hashes)')
