import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')

// 48: invoices are financial records. The page must authenticate, resolve the
// active workspace, and scope the read to it.
const invoices = read('../app/invoices/page.tsx')
assert.match(invoices, /auth\.getUser\(\)/, 'invoices page must require authentication')
assert.match(invoices, /rpc\('current_workspace_id'\)/, 'invoices page must resolve the workspace')
assert.match(invoices, /\.eq\('workspace_id', workspaceId\)/, 'invoices read must be workspace-scoped')
assert.match(invoices, /if \(!workspaceId\)/, 'invoices page must fail closed without a workspace')

// 49: every lead mutation keyed by an id from the URL must also carry the
// workspace predicate, matching the pattern used for lead_activity inserts.
const leads = read('../app/leads/[id]/page.tsx')
const updates = [...leads.matchAll(/from\('leads'\)\.update\([\s\S]*?\)\.eq\('id', lead\.id\)([\s\S]{0,120})/g)]
assert.ok(updates.length >= 3, `expected at least three lead updates, found ${updates.length}`)
for (const [, tail] of updates) {
  assert.match(tail, /\.eq\('workspace_id', workspaceId\)/, 'every lead update must be workspace-scoped')
}
assert.ok(!/\.eq\('id', lead\.id\)\s*\n\s*if \(updateError\)/.test(leads), 'no bare id-only lead update may remain')

// 51: a caller-supplied leadId on supplement POST must be proven to be in the
// active workspace before it is stored and echoed back by GET.
const supplementsRoute = read('../app/api/supplements/route.ts')
const supplementsPost = supplementsRoute.slice(supplementsRoute.indexOf('export async function POST'))
assert.match(supplementsPost, /isUuid\(body\.leadId\)/, 'supplements POST must validate the leadId UUID')
assert.match(
  supplementsPost,
  /\.from\('leads'\)\s*\.select\('id'\)[\s\S]{0,240}\.eq\('id',\s*body\.leadId\)[\s\S]{0,160}\.eq\('workspace_id',\s*workspaceId\)/,
  'supplements POST must prove the lead belongs to the active workspace'
)
assert.match(supplementsPost, /if \(!lead\)/, 'supplements POST must reject a foreign lead')

// 57: the "Workspace activity" feed must authenticate, resolve and fail closed
// before scoping its read, matching the invoices page pattern.
const activity = read('../app/activity/page.tsx')
assert.match(activity, /auth\.getUser\(\)/, 'activity page must require authentication')
assert.match(activity, /rpc\('current_workspace_id'\)/, 'activity page must resolve the workspace')
assert.match(activity, /if \(!workspaceId\)/, 'activity page must fail closed without a workspace')
assert.match(activity, /from\('lead_activity'\)[\s\S]{0,200}\.eq\('workspace_id', workspaceId\)/, 'activity feed must be workspace-scoped')

console.log('web-workspace-scoping-test: PASS (source contract: invoices, lead updates, supplement lead binding and activity feed)')
