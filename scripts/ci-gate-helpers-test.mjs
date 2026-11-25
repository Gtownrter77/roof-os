import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

const root = new URL('./ci/', import.meta.url).pathname
const collector = join(root, 'collect-gate-results.mjs')
const parity = join(root, 'check-schema-parity.mjs')
const canonical = [
  'repositoryChecks', 'stagingMigration', 'authenticatedReadOnly', 'stagingRls',
  'stagingHeartbeat', 'physicalDevice', 'backupRestore', 'schemaParity',
  'workerRuntime', 'providerExecution',
]
const runId = '45556458513'
const sha = '0f8c77422d72378b8e1e8b02ff7c4f9d197d6c65'

function collect(markers, { write = markers } = {}) {
  const out = join(mkdtempSync(join(tmpdir(), 'roof-collect-')), 'input.json')
  const result = spawnSync(process.execPath, [
    collector,
    '--markers', markers,
    '--output', out,
    '--run-id', runId,
    '--sha', sha,
  ], { encoding: 'utf8' })
  return { result, input: result.status === 0 ? JSON.parse(readFileSync(out, 'utf8')) : null }
}

function makeMarkers({ skip = [] } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'roof-markers-'))
  for (const gate of canonical.filter((name) => name !== 'physicalDevice' && !skip.includes(name))) {
    writeFileSync(join(dir, `${gate}.pass`), '')
  }
  return dir
}

{
  const { result, input } = collect(makeMarkers())
  assert.equal(result.status, 0, result.stderr)
  assert.deepEqual(Object.keys(input), canonical)
  assert.equal(input.physicalDevice.status, 'UNKNOWN')
  for (const gate of canonical.filter((name) => name !== 'physicalDevice')) {
    assert.equal(input[gate].status, 'PASS')
    assert.deepEqual(input[gate].source, { runId, sha, check: `free-evidence/${gate}` })
  }
}

{
  const { result } = collect(makeMarkers({ skip: ['stagingRls'] }))
  assert.notEqual(result.status, 0, 'missing marker must fail closed')
  assert.match(result.stderr, /stagingRls/)
}

{
  const dir = makeMarkers()
  writeFileSync(join(dir, 'physicalDevice.pass'), '')
  const { result, input } = collect(dir)
  assert.equal(result.status, 0, result.stderr)
  assert.equal(input.physicalDevice.status, 'UNKNOWN', 'a physical-device marker must not fabricate device evidence')
}

{
  const dir = mkdtempSync(join(tmpdir(), 'roof-parity-'))
  const manifest = join(dir, 'manifest.json')
  const applied = join(dir, 'applied.txt')
  writeFileSync(manifest, JSON.stringify({
    removed: [],
    kept: ['001_leads.sql', '021_agent_runs_idempotency_contract.sql', '114_jarvis_adjuster.sql'],
  }))
  writeFileSync(applied, '001\n021\n114\n')
  let result = spawnSync(process.execPath, [parity, manifest, applied], { encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr)

  writeFileSync(applied, '001\n021\n')
  result = spawnSync(process.execPath, [parity, manifest, applied], { encoding: 'utf8' })
  assert.notEqual(result.status, 0, 'missing applied migration must fail closed')
  assert.match(result.stderr, /114/)

  writeFileSync(applied, '001\n021\n114\n999\n')
  result = spawnSync(process.execPath, [parity, manifest, applied], { encoding: 'utf8' })
  assert.notEqual(result.status, 0, 'extra applied migration must fail closed')
  assert.match(result.stderr, /999/)
}

const generated = join(root, 'assert-generated-evidence.mjs')

function checkGenerated(evidence, provenance = null) {
  const dir = mkdtempSync(join(tmpdir(), 'roof-generated-'))
  const evidencePath = join(dir, 'release-gates.json')
  writeFileSync(evidencePath, JSON.stringify(evidence))
  let provenancePath
  if (provenance) {
    provenancePath = join(dir, 'provenance.json')
    writeFileSync(provenancePath, JSON.stringify(provenance))
  }
  return spawnSync(process.execPath, [generated, evidencePath, ...(provenancePath ? [provenancePath] : [])], { encoding: 'utf8' })
}

{
  const evidence = Object.fromEntries(canonical.map((gate) => [gate, gate === 'physicalDevice' ? 'UNKNOWN' : 'PASS']))
  const provenance = {
    runId: '45556458513',
    sha,
    gates: Object.fromEntries(canonical.filter((gate) => gate !== 'physicalDevice').map((gate) => [gate, {
      runId: '45556458513', sha, check: `free-evidence/${gate}`,
    }])),
  }
  const result = checkGenerated(evidence, provenance)
  assert.equal(result.status, 0, result.stderr)
}

{
  const evidence = Object.fromEntries(canonical.map((gate) => [gate, 'PASS']))
  const result = checkGenerated(evidence)
  assert.notEqual(result.status, 0, 'physicalDevice PASS must be rejected')
  assert.match(result.stderr, /physicalDevice/)
}

{
  const evidence = Object.fromEntries(canonical.map((gate) => [gate, gate === 'stagingRls' || gate === 'physicalDevice' ? 'UNKNOWN' : 'PASS']))
  const result = checkGenerated(evidence)
  assert.notEqual(result.status, 0, 'a missing PASS gate must be rejected')
  assert.match(result.stderr, /stagingRls/)
}

console.log('ci-gate-helpers-test: PASS (marker-derived evidence, schema parity set equality, generated evidence guard)')
