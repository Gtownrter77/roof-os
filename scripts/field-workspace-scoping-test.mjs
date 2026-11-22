import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const app = readFileSync('apps/field/App.tsx', 'utf8')
const check = (pattern, label) => assert.ok(pattern.test(app), label)

// Leads must be tenant-scoped exactly like appointments/tasks (002 RLS allows
// any workspace member to read every lead, so the client filter is the only
// guard against cross-tenant lead_id links on inspection sessions).
check(
  /supabase\.from\('leads'\)\.select\('id,name,address,status'\)[\s\S]{0,120}\.eq\('workspace_id', workspaceId\)/,
  'field leads query must be scoped to the active workspace',
)

// The workspace learned while online must be cached and stamped onto drafts so
// a later workspace switch cannot silently file an offline inspection elsewhere.
check(/const workspaceRef = useRef<string \| null>\(null\)/, 'workspace ref must exist')
check(
  /const \{ data: workspaceId, error: workspaceError \} = await supabase\.rpc\('current_workspace_id'\)\s*\n\s*if \(workspaceError \|\| !workspaceId\) return\s*\n\s*workspaceRef\.current = workspaceId/,
  'loadFieldData must cache the active workspace',
)
check(
  /'INSERT INTO inspection_drafts \(owner_user_id, workspace_id,[\s\S]{0,400}session\.user\.id,\s*\n\s*workspaceRef\.current,/,
  'draft creation must persist the cached workspace instead of null',
)
check(/workspaceId: workspaceRef\.current,/, 'in-memory draft must carry the cached workspace')
assert.ok(
  !/session\.user\.id,\s*\n\s*null,\s*\n\s*createdClientId/.test(app),
  'draft creation must no longer hardcode a null workspace',
)
check(
  /if \(!draftToSync\.workspaceId\) throw new Error\('This draft has no recorded workspace/,
  'sync must reject legacy drafts with no recorded workspace',
)
check(
  /if \(draftToSync\.workspaceId !== workspaceId\) throw new Error\('This draft belongs to a different workspace/,
  'sync must reject a draft captured under a different workspace',
)
check(/readCachedFieldWorkspace\(\)/, 'cached workspace must be hydrated on boot')
check(/cacheFieldWorkspace\(session\.user\.id, workspaceId\)/, 'learned workspace must be persisted per user')
check(/if \(!workspaceRef\.current\) \{[\s\S]{0,200}return null/, 'draft creation must fail closed when the workspace is unknown')
check(/await clearCachedFieldWorkspace\(\)/, 'sign-out must clear the cached workspace')

console.log('field-workspace-scoping-test: PASS (leads scoped; drafts carry a persisted workspace; sync rejects missing/mismatched workspace)')
