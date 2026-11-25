#!/usr/bin/env node
import assert from 'node:assert/strict'
import { readFileSync, renameSync, writeFileSync } from 'node:fs'

const canonical = [
  'repositoryChecks', 'stagingMigration', 'authenticatedReadOnly', 'stagingRls',
  'stagingHeartbeat', 'physicalDevice', 'backupRestore', 'schemaParity',
  'workerRuntime', 'providerExecution',
]
const statuses = new Set(['PASS', 'FAIL', 'UNKNOWN'])

const [inputPath, outputPath] = process.argv.slice(2)
assert.ok(inputPath && outputPath, 'usage: ci-evidence-writer.mjs <input.json> <output.json>')
const input = JSON.parse(readFileSync(inputPath, 'utf8'))
assert.ok(input && typeof input === 'object' && !Array.isArray(input), 'input must be an object')

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
}

const evidence = Object.fromEntries(canonical.map((name) => [name, input[name]?.status ?? 'UNKNOWN']))
const tmp = `${outputPath}.tmp`
writeFileSync(tmp, `${JSON.stringify(evidence, null, 2)}\n`)
renameSync(tmp, outputPath)
console.log(`ci-evidence-writer: wrote ${canonical.filter((name) => evidence[name] === 'PASS').length} PASS gates`)
