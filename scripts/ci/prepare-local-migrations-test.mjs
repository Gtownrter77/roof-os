import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

const script = new URL('./prepare-local-migrations.mjs', import.meta.url).pathname
const duplicated = {
  '021_photo_estimate_workflows.sql': 'photo workflow',
  '022_photo_estimate_workflows.sql': 'photo workflow',
  '022_soffit_measurement_fields.sql': 'soffit fields',
  '023_soffit_measurement_fields.sql': 'soffit fields',
  '023_photo_refresh_decisions.sql': 'photo refresh',
  '024_photo_refresh_decisions.sql': 'photo refresh',
}

function makeRepo({ overrides = {}, extra = {} } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'roof-migrations-source-'))
  mkdirSync(join(root, 'supabase', 'migrations'), { recursive: true })
  writeFileSync(join(root, 'supabase', 'config.toml'), 'project_id = "roof-os"\n')
  const files = {
    '001_leads.sql': 'create table leads();',
    '021_agent_runs_idempotency_contract.sql': 'create table agent_runs();',
    ...duplicated,
    '114_jarvis_adjuster.sql': 'create table jarvis();',
    ...extra,
  }
  for (const [name, content] of Object.entries({ ...files, ...overrides })) {
    writeFileSync(join(root, 'supabase', 'migrations', name), content)
  }
  return root
}

function run(source, target) {
  return spawnSync(process.execPath, [script, source, target], { encoding: 'utf8' })
}

{
  const source = makeRepo()
  const target = join(mkdtempSync(join(tmpdir(), 'roof-migrations-target-')), 'workdir')
  const result = run(source, target)
  assert.equal(result.status, 0, result.stderr)
  const names = readdirSync(join(target, 'supabase', 'migrations')).sort()
  assert.deepEqual(names, [
    '001_leads.sql',
    '021_agent_runs_idempotency_contract.sql',
    '022_photo_estimate_workflows.sql',
    '023_soffit_measurement_fields.sql',
    '024_photo_refresh_decisions.sql',
    '114_jarvis_adjuster.sql',
  ])
  assert.equal(readFileSync(join(target, 'supabase', 'config.toml'), 'utf8'), 'project_id = "roof-os"\n')
  for (const name of names) {
    const original = readFileSync(join(source, 'supabase', 'migrations', name), 'utf8')
    assert.equal(readFileSync(join(target, 'supabase', 'migrations', name), 'utf8'), original)
  }
  const manifest = JSON.parse(readFileSync(join(target, 'ci-migration-manifest.json'), 'utf8'))
  assert.deepEqual(manifest.removed, [
    '021_photo_estimate_workflows.sql',
    '022_soffit_measurement_fields.sql',
    '023_photo_refresh_decisions.sql',
  ])
  assert.deepEqual(manifest.kept, names)
  assert.deepEqual(readdirSync(join(source, 'supabase', 'migrations')).sort(), [
    '001_leads.sql',
    '021_agent_runs_idempotency_contract.sql',
    '021_photo_estimate_workflows.sql',
    '022_photo_estimate_workflows.sql',
    '022_soffit_measurement_fields.sql',
    '023_photo_refresh_decisions.sql',
    '023_soffit_measurement_fields.sql',
    '024_photo_refresh_decisions.sql',
    '114_jarvis_adjuster.sql',
  ])
}

{
  const source = makeRepo({ overrides: { '021_photo_estimate_workflows.sql': 'different SQL' } })
  const target = join(mkdtempSync(join(tmpdir(), 'roof-migrations-target-')), 'workdir')
  const result = run(source, target)
  assert.notEqual(result.status, 0, 'differing duplicate content must fail closed')
  assert.match(result.stderr, /021_photo_estimate_workflows\.sql/)
}

{
  const source = makeRepo({ extra: { '021_unexpected.sql': 'unexpected' } })
  const target = join(mkdtempSync(join(tmpdir(), 'roof-migrations-target-')), 'workdir')
  const result = run(source, target)
  assert.notEqual(result.status, 0, 'unexpected collision set must fail closed')
  assert.match(result.stderr, /collision/)
}

{
  const source = makeRepo()
  const migrations = join(source, 'supabase', 'migrations')
  const { unlinkSync } = await import('node:fs')
  unlinkSync(join(migrations, '022_photo_estimate_workflows.sql'))
  const target = join(mkdtempSync(join(tmpdir(), 'roof-migrations-target-')), 'workdir')
  const result = run(source, target)
  assert.notEqual(result.status, 0, 'missing expected duplicate must fail closed')
  assert.match(result.stderr, /022_photo_estimate_workflows\.sql/)
}

console.log('prepare-local-migrations-test: PASS (collision-free temp workdir, fail-closed on drift)')
