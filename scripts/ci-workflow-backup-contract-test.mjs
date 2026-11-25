import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const workflow = readFileSync('.github/workflows/free-evidence.yml', 'utf8')
const step = workflow.split('      - name: Verify backup and restore rehearsal')[1]?.split('      - name:')[0] ?? ''
assert.ok(step, 'backup rehearsal step must exist')

assert.ok(
  step.includes('pg_dump "$DB_URL" --format=custom --no-owner --file "$BACKUP_FILE"'),
  'backup must be a full-database custom-format pg_dump',
)
assert.ok(
  step.includes('pg_restore --no-owner --dbname "$restore_url" "$BACKUP_FILE"'),
  'restore must use pg_restore into the fresh database',
)
const backupCommand = step.split('\n').find((line) => line.includes('--file "$BACKUP_FILE"')) ?? ''
assert.ok(backupCommand, 'backup command must use the BACKUP_FILE path')
assert.ok(
  !backupCommand.includes('--schema public'),
  'a public-only backup leaves dangling auth references and cannot be restored',
)
for (const check of [
  'source_tables="$(psql "$DB_URL" -tAc "select count(*)::text from pg_tables where schemaname = \'public\'" | tr -d \'\\r\')"',
  'restored_tables="$(psql "$restore_url" -tAc "select count(*)::text from pg_tables where schemaname = \'public\'" | tr -d \'\\r\')"',
  'test "$source_tables" -gt 0',
  'test "$restored_tables" = "$source_tables"',
  'pg_dump "$DB_URL" --data-only --no-owner --schema public',
  'pg_dump "$restore_url" --data-only --no-owner --schema public',
  'test "$source_data_hash" = "$restored_data_hash"',
]) {
  assert.ok(step.includes(check), `backup step must verify: ${check}`)
}

console.log('ci-workflow-backup-contract-test: PASS (full-database dump/restore with table and data checks)')
