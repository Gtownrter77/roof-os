import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const runtime = readFileSync('workers/agent-runtime.ts', 'utf8')
const readme = readFileSync('workers/README.md', 'utf8')

for (const marker of [
  "reviewTaskCreatorId?: string",
  "from('workspaces')",
  "event.workspaceId",
  "event.agentKey",
  "event.eventKey",
  "existing.attempt ?? 1) + 1",
  "status: 'failed'",
  "from('tasks').insert",
  'created_by: config.reviewTaskCreatorId',
]) assert.ok(runtime.includes(marker), `runtime contract missing: ${marker}`)

for (const marker of [
  'stable event key',
  'failed record',
  'two-workspace isolation test',
]) assert.ok(readme.includes(marker), `worker readiness contract missing: ${marker}`)

// The runtime must not claim that a worker is deployed merely because the scaffold exists.
assert.match(readme, /does not pretend that a worker is deployed/i)
console.log('agent-runtime-test: PASS')
