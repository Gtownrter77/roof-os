#!/usr/bin/env node
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const [evidencePath, provenancePath] = process.argv.slice(2)
assert.ok(evidencePath, 'usage: assert-generated-evidence.mjs <evidence.json> [provenance.json]')
const canonical = [
  'repositoryChecks', 'stagingMigration', 'authenticatedReadOnly', 'stagingRls',
  'stagingHeartbeat', 'physicalDevice', 'backupRestore', 'schemaParity',
  'workerRuntime', 'providerExecution',
]
const statuses = new Set(['PASS', 'FAIL', 'UNKNOWN'])
const evidence = JSON.parse(readFileSync(evidencePath, 'utf8'))
assert.ok(evidence && typeof evidence === 'object' && !Array.isArray(evidence), 'evidence must be an object')
assert.deepEqual(Object.keys(evidence).sort(), [...canonical].sort(), 'evidence gates must match the canonical set')
for (const gate of canonical) {
  assert.ok(statuses.has(evidence[gate]), `${gate}: status must be PASS, FAIL, or UNKNOWN`)
}
const nonPass = canonical.filter((gate) => evidence[gate] !== 'PASS')
assert.deepEqual(nonPass, ['physicalDevice'], `unexpected non-PASS gates: ${nonPass.join(', ')}`)
assert.equal(evidence.physicalDevice, 'UNKNOWN', 'physicalDevice must remain UNKNOWN')

if (provenancePath) {
  const provenance = JSON.parse(readFileSync(provenancePath, 'utf8'))
  assert.match(String(provenance.sha ?? ''), /^[0-9a-f]{40}$/, 'provenance.sha must be a full commit SHA')
  assert.ok(String(provenance.runId ?? '').trim(), 'provenance.runId is required')
  for (const gate of canonical.filter((name) => name !== 'physicalDevice')) {
    const source = provenance.gates?.[gate]
    assert.ok(source, `${gate}: provenance source is required`)
    assert.equal(source.sha, provenance.sha, `${gate}: provenance SHA mismatch`)
    assert.equal(source.runId, provenance.runId, `${gate}: provenance runId mismatch`)
    assert.equal(source.check, `free-evidence/${gate}`, `${gate}: provenance check mismatch`)
  }
}
console.log('assert-generated-evidence: PASS (9 marker-backed PASS gates, physicalDevice UNKNOWN)')
