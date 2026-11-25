import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

const writer = new URL('./ci-evidence-writer.mjs', import.meta.url).pathname
const canonical = [
  'repositoryChecks', 'stagingMigration', 'authenticatedReadOnly', 'stagingRls',
  'stagingHeartbeat', 'physicalDevice', 'backupRestore', 'schemaParity',
  'workerRuntime', 'providerExecution',
]
const source = { runId: '45532977857', sha: '0f8c77422d72378b8e1e8b02ff7c4f9d197d6c65', check: 'free-evidence' }

function run(input) {
  const dir = mkdtempSync(join(tmpdir(), 'roof-ci-evidence-'))
  const inPath = join(dir, 'input.json')
  const outPath = join(dir, 'out.json')
  writeFileSync(inPath, JSON.stringify(input))
  const result = spawnSync(process.execPath, [writer, inPath, outPath], { encoding: 'utf8' })
  const output = result.status === 0 ? JSON.parse(readFileSync(outPath, 'utf8')) : null
  return { status: result.status, stderr: result.stderr, output }
}

{
  const r = run({ repositoryChecks: { status: 'PASS', source }, stagingRls: { status: 'PASS', source } })
  assert.equal(r.status, 0, r.stderr)
  assert.deepEqual(Object.keys(r.output), canonical)
  assert.equal(r.output.repositoryChecks, 'PASS')
  assert.equal(r.output.stagingRls, 'PASS')
  assert.ok(canonical.every((k) => r.output[k] === 'PASS' || r.output[k] === 'UNKNOWN'))
}
{
  const r = run({ stagingMigration: { status: 'PASS', source: { ...source, runId: undefined } } })
  assert.notEqual(r.status, 0, 'PASS without a run id must fail closed')
  assert.match(r.stderr, /runId/)
}
{
  const r = run({ stagingMigration: { status: 'PASS', source: { ...source, sha: '0f8c774' } } })
  assert.notEqual(r.status, 0, 'PASS with a non-full SHA must fail closed')
  assert.match(r.stderr, /sha/)
}
{
  const r = run({ stagingMigration: { status: 'UNKNOWN' } })
  assert.equal(r.status, 0, r.stderr)
  assert.equal(r.output.stagingMigration, 'UNKNOWN')
}
{
  const r = run({ rogueGate: { status: 'PASS', source } })
  assert.notEqual(r.status, 0, 'unknown gate keys must fail closed')
  assert.match(r.stderr, /rogueGate/)
}
{
  const r = run({ backupRestore: { status: 'FAIL', source } })
  assert.equal(r.status, 0, r.stderr)
  assert.equal(r.output.backupRestore, 'FAIL')
}
{
  const r = run({ stagingHeartbeat: { status: 'PASS', source } })
  assert.equal(r.status, 0)
  assert.ok(!JSON.stringify(r.output).includes('runId'), 'metadata must not leak into the evidence file')
}

console.log('ci-evidence-writer-test: PASS (fail-closed source checks, canonical evidence only)')
