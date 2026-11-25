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
const source = { runId: '45532977857', sha: '0f8c77422d72378b8e1e8b02ff7c4f9d197d6c65', check: 'free-evidence/repositoryChecks' }

function run(input, { expectedSha, provenance = false } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'roof-ci-evidence-'))
  const inPath = join(dir, 'input.json')
  const outPath = join(dir, 'out.json')
  const provPath = join(dir, 'provenance.json')
  writeFileSync(inPath, JSON.stringify(input))
  const args = [writer, inPath, outPath, ...(provenance ? [provPath] : [])]
  const env = { ...process.env }
  if (expectedSha) env.EXPECTED_SHA = expectedSha
  else delete env.EXPECTED_SHA
  const result = spawnSync(process.execPath, args, { encoding: 'utf8', env })
  const output = result.status === 0 ? JSON.parse(readFileSync(outPath, 'utf8')) : null
  const manifest = provenance && result.status === 0 ? JSON.parse(readFileSync(provPath, 'utf8')) : null
  return { status: result.status, stderr: result.stderr, output, manifest }
}

{
  const r = run(
    { repositoryChecks: { status: 'PASS', source }, stagingRls: { status: 'PASS', source } },
    { provenance: true },
  )
  assert.equal(r.status, 0, r.stderr)
  assert.deepEqual(Object.keys(r.output), canonical)
  assert.equal(r.output.repositoryChecks, 'PASS')
  assert.equal(r.output.stagingRls, 'PASS')
  assert.ok(canonical.every((k) => r.output[k] === 'PASS' || r.output[k] === 'UNKNOWN'))
  assert.ok(!JSON.stringify(r.output).includes('runId'), 'metadata must not leak into the evidence file')
  assert.equal(r.manifest.runId, source.runId)
  assert.equal(r.manifest.sha, source.sha)
  assert.deepEqual(r.manifest.gates.repositoryChecks, source)
  assert.deepEqual(r.manifest.gates.stagingRls, source)
  assert.ok(!r.manifest.gates.physicalDevice, 'UNKNOWN gates must not carry provenance')
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
  const r = run({ stagingMigration: { status: 'PASS', source } }, { expectedSha: 'a'.repeat(40) })
  assert.notEqual(r.status, 0, 'PASS from a different SHA must fail closed')
  assert.match(r.stderr, /EXPECTED_SHA/)
}
{
  const mixed = { ...source, runId: '999' }
  const r = run({
    repositoryChecks: { status: 'PASS', source },
    stagingRls: { status: 'PASS', source: mixed },
  })
  assert.notEqual(r.status, 0, 'mixed provenance must fail closed')
  assert.match(r.stderr, /same run/)
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

console.log('ci-evidence-writer-test: PASS (fail-closed provenance, canonical evidence only)')
