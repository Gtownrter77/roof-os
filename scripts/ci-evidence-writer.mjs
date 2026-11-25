#!/usr/bin/env node
import assert from 'node:assert/strict'
import { readFileSync, renameSync, writeFileSync } from 'node:fs'

const canonical = [
  'repositoryChecks', 'stagingMigration', 'authenticatedReadOnly', 'stagingRls',
  'stagingHeartbeat', 'physicalDevice', 'backupRestore', 'schemaParity',
  'workerRuntime', 'providerExecution',
]
const statuses = new Set(['PASS', 'FAIL', 'UNKNOWN'])

const [inputPath, outputPath, provenancePath] = process.argv.slice(2)
assert.ok(inputPath && outputPath, 'usage: ci-evidence-writer.mjs <input.json> <output.json> [provenance.json]')
const input = JSON.parse(readFileSync(inputPath, 'utf8'))
assert.ok(input && typeof input === 'object' && !Array.isArray(input), 'input must be an object')

const seenSources = []
for (const [name, entry] of Object.entries(input)) {
  assert.ok(canonical.includes(name), `unknown evidence gate: ${name}`)
  assert.ok(entry && typeof entry === 'object' && !Array.isArray(entry), `${name}: entry must be an object`)
  assert.ok(statuses.has(entry.status), `${name}: status must be PASS, FAIL, or UNKNOWN`)
  if (entry.status === 'UNKNOWN') continue
  const source = entry.source
  assert.ok(source && typeof source === 'object', `${name}: PASS/FAIL requires a source`)
  assert.ok(String(source.runId ?? '').trim(), `${name}: source.runId is required`)
  assert.match(String(source.sha ?? ''), /^[0-9a-f]{40}$/, `${name}: source.sha must be a full 40-char commit SHA`)
  assert.ok(String(source.check ?? '').trim(), `${name}: source.check is required`)
  if (process.env.EXPECTED_SHA) {
    assert.equal(source.sha, process.env.EXPECTED_SHA, `${name}: source.sha must equal EXPECTED_SHA`)
  }
  seenSources.push(source)
}
if (seenSources.length > 1) {
  const first = seenSources[0]
  for (const source of seenSources.slice(1)) {
    assert.equal(source.runId, first.runId, 'all PASS/FAIL gates must come from the same run')
    assert.equal(source.sha, first.sha, 'all PASS/FAIL gates must come from the same commit')
  }
}

const evidence = Object.fromEntries(canonical.map((name) => [name, input[name]?.status ?? 'UNKNOWN']))
const writeAtomic = (path, value) => {
  const tmp = `${path}.tmp`
  writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`)
  renameSync(tmp, path)
}
writeAtomic(outputPath, evidence)
if (provenancePath) {
  const gates = Object.fromEntries(canonical
    .filter((name) => input[name]?.source)
    .map((name) => [name, input[name].source]))
  writeAtomic(provenancePath, {
    runId: seenSources[0]?.runId ?? null,
    sha: seenSources[0]?.sha ?? null,
    gates,
  })
}
console.log(`ci-evidence-writer: wrote ${canonical.filter((name) => evidence[name] === 'PASS').length} PASS gates`)
