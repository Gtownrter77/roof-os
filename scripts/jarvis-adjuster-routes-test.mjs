import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const claims = read('app/api/jarvis/claims/route.ts')
const disable = read('app/api/jarvis/claims/[id]/disable/route.ts')
const inbound = read('app/api/jarvis/inbound/route.ts')
const settings = read('app/api/jarvis/settings/route.ts')
const worker = read('app/api/jarvis/worker/route.ts')

assert.match(claims, /requireWorkspaceMember/)
assert.match(claims, /enrollClaim\(ctx\.supabase/)
assert.match(claims, /process\.env\.JARVIS_ADJUSTER_IDENTITY_ID/)
assert.doesNotMatch(claims, /body\.identityId/)
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
assert.match(inbound, /claimId: claim\.id/, 'the actual claim id must reach the atomic RPC')

// Workspace kill switch is admin-gated and uses the durable cancel RPC.
assert.match(settings, /is_workspace_admin/)
assert.match(settings, /disableDecision\(\{ kind: 'workspace'/)
assert.match(settings, /maybeSingle\(\)/)

// The worker loads live DB policy and grants itself no implicit authorization.
assert.match(worker, /runJobWithPolicies/)
assert.match(worker, /mapJobRow\(queued as Record<string, unknown>\)/, 'snake_case DB rows must be mapped')
assert.match(worker, /resolveConsent\(consentRows, channel, contact, now\)/)
assert.match(worker, /consentContactKey\(channel, contact\)/, 'consent rows must be queried by normalized contact')
assert.match(worker, /\.eq\('phone', consentContact\)/, 'workspace-wide STOP rows have no lead id')
assert.doesNotMatch(worker, /\.eq\('lead_id', claim\.lead_id\)/, 'a lead-scoped query misses plain STOP records')
assert.match(worker, /if \(settingsError\) throw adjusterError/, 'a settings read failure must fail closed')
assert.match(worker, /planOnly: settings\?\.plan_only \?\? true/)
assert.match(worker, /authorized: process\.env\.JARVIS_ADJUSTER_EXECUTION_AUTHORIZED === 'true'/)
assert.match(worker, /receptionist_consents/)
assert.match(worker, /workspace_adjuster_settings/)
assert.match(worker, /JARVIS_ADJUSTER_WORKER_SECRET/)
assert.match(worker, /isAuthorizedWorkerAuthHeader/)
assert.match(worker, /locked_by: workerId/)
assert.match(worker, /\.eq\('locked_by', workerId\)/, 'only the lease holder may finish a job')
assert.match(worker, /\.lt\('locked_at', staleBefore\)/, 'stale leases are recovered')

console.log('jarvis-adjuster HTTP route contract passed')
