#!/usr/bin/env node
import assert from 'node:assert/strict'
import { existsSync, renameSync, writeFileSync } from 'node:fs'

const canonical = [
  'repositoryChecks', 'stagingMigration', 'authenticatedReadOnly', 'stagingRls',
  'stagingHeartbeat', 'physicalDevice', 'backupRestore', 'schemaParity',
  'workerRuntime', 'providerExecution',
]
const required = canonical.filter((gate) => gate !== 'physicalDevice')

const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, arg, index, all) => {
  if (arg.startsWith('--')) pairs.push([arg.slice(2), all[index + 1]])
  return pairs
}, []))
for (const name of ['markers', 'output', 'run-id', 'sha']) {
  assert.ok(args[name], `--${name} is required`)
}
assert.match(args.sha, /^[0-9a-f]{40}$/, '--sha must be a full commit SHA')
assert.ok(String(args['run-id']).trim(), '--run-id must not be empty')

const missing = required.filter((gate) => !existsSync(`${args.markers}/${gate}.pass`))
assert.deepEqual(missing, [], `missing gate markers: ${missing.join(', ')}`)

const input = Object.fromEntries(required.map((gate) => [gate, {
  status: 'PASS',
  source: { runId: args['run-id'], sha: args.sha, check: `free-evidence/${gate}` },
}]))
input.physicalDevice = { status: 'UNKNOWN' }
const ordered = Object.fromEntries(canonical.map((gate) => [gate, input[gate]]))

const tmp = `${args.output}.tmp`
writeFileSync(tmp, `${JSON.stringify(ordered, null, 2)}\n`)
renameSync(tmp, args.output)
console.log(`collect-gate-results: ${required.length} marker-backed PASS gates, physicalDevice UNKNOWN`)
