import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const claims = read('app/api/jarvis/claims/route.ts')
const disable = read('app/api/jarvis/claims/[id]/disable/route.ts')
const inbound = read('app/api/jarvis/inbound/route.ts')

assert.match(claims, /requireWorkspaceMember/)
assert.match(claims, /claimReadScope\(ctx\.workspaceId\)/)
assert.match(claims, /\.eq\('workspace_id', ctx\.workspaceId\)/, 'lead must be verified in the caller workspace')
assert.match(claims, /enqueueJob\(ctx\.supabase/)
assert.match(claims, /jobQueued: false/, 'enqueue failure must be reported, not hidden')

assert.match(disable, /disableDecision\(\{ kind: 'claim'/)
assert.match(disable, /supabase\.rpc\(decision\.function, args\)/, 'disable must call the real stop RPC')
assert.match(disable, /\.eq\('workspace_id', workspaceId\)/)

assert.match(inbound, /JARVIS_ADJUSTER_WORKSPACE_ID/, 'workspace comes from deployment config')
assert.match(inbound, /Bearer \$\{secret\}/)
assert.match(inbound, /\.eq\('workspace_id', workspaceId\)/)
assert.match(inbound, /writeInbound\(/)
assert.match(inbound, /claim\.workspace_id/)
assert.doesNotMatch(inbound, /body\.workspaceId/, 'the request body cannot choose the workspace')

console.log('jarvis-adjuster HTTP route contract passed')
