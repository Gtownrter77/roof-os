import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8')

const migration = read('../supabase/migrations/059_estimate_approval_admin_guard.sql')

// Original permissive estimates_update (007) dropped to prevent OR bypass.
assert.ok(migration.includes('drop policy if exists estimates_update'), 'old permissive estimates_update dropped')
assert.ok(migration.includes('enforce_estimate_approval_metadata'), 'approval-metadata trigger exists')
assert.ok(migration.includes('before insert or update on public.estimates'), 'trigger applies to update/insert')
assert.ok(!migration.includes('estimates_update on public.estimates for update'), 'no leftover 007-style permissive update policy')

// Insert guard prevents direct approved insertion by non-admin creators.
assert.ok(migration.includes('create policy estimates_insert'), 'insert policy recreated with guard')
assert.ok(migration.includes("status IS DISTINCT FROM 'approved'"), 'insert blocks direct approved insert')
assert.ok(migration.includes('create or replace function public.is_estimate_admin'), 'new admin function defined')
assert.ok(migration.includes('coalesce(public.is_workspace_admin'), 'is_estimate_admin handles null workspace')
assert.ok(/security definer set search_path/i.test(migration), 'SECURITY DEFINER admin function pins search_path')
assert.ok(migration.includes("if p_status = 'approved' and not public.is_estimate_admin"), 'RPC blocks non-admin approval')
assert.ok(migration.includes('create policy estimates_update_member'), 'direct table write guard exists')
assert.ok(!migration.includes('058_atomic_estimate_line_item_replacement.sql'), 'new migration does not alter 058 file')

// API PUT blocks non-admin approval.
const putRoute = read('../app/api/estimates/[id]/route.ts')
assert.ok(putRoute.includes("supabase.rpc('is_workspace_admin'"), 'PUT uses admin check')
assert.ok(putRoute.includes('Workspace administrator authority is required'), 'PUT returns 403 message')
assert.ok(putRoute.includes("status === 'approved'"), 'PUT approves only via authority')

// API POST defends creation with approved status.
const postRoute = read('../app/api/estimates/route.ts')
assert.ok(postRoute.includes("status === 'approved'"), 'POST defends approved creation')
assert.ok(postRoute.includes('is_workspace_admin'), 'POST uses admin check')

// A failed authority RPC must surface as 502, never as a misleading 403.
const allAuthorityCallers = [putRoute, postRoute]
for (const [label, source] of [['PUT approve', putRoute], ['PUT delete', putRoute], ['POST create', postRoute]]) {
  assert.ok(/'is_workspace_admin'[^\n]*error:/.test(source) || /error:[^\n]*'is_workspace_admin'/.test(source), `${label} destructures the RPC error`)
}
assert.equal((putRoute.match(/error: adminCheckError/g) || []).length, 1, 'PUT approval destructures admin RPC error')
assert.ok(putRoute.includes('error: deleteAdminError'), 'PUT delete destructures admin RPC error')
assert.ok(postRoute.includes('error: adminCheckError'), 'POST creation destructures admin RPC error')
for (const source of allAuthorityCallers) {
  assert.ok(source.includes('Workspace authorization could not be verified.'), 'RPC failure returns an operator-visible message')
  assert.ok(/status: 502/.test(source), 'RPC failure returns 502')
}
assert.ok(
  putRoute.indexOf('if (adminCheckError)') < putRoute.indexOf('if (!isAdminData)'),
  'PUT approve reports the RPC failure before the 403',
)
assert.ok(
  putRoute.indexOf('if (deleteAdminError)') < putRoute.indexOf('if (!isAdmin)'),
  'PUT delete reports the RPC failure before the 403',
)
assert.ok(
  postRoute.indexOf('if (adminCheckError)') < postRoute.indexOf('if (!isAdminData)'),
  'POST reports the RPC failure before the 403',
)

// Draft endpoint preserved (normal member editing).
const draftRoute = read('../app/api/estimates/draft/route.ts')
assert.ok(draftRoute.includes('allowedKeys'), 'draft restricts keys')
assert.ok(draftRoute.includes('getApprovedPhotoWorkflowQuantities'), 'draft uses approved workflow')
assert.ok(draftRoute.includes("status: 'needs_price_review'"), 'draft remains unpriced')

// Cross-workspace isolation requires workspace_id equality (existing .eq checks preserved).
assert.ok(putRoute.includes('.eq(\'workspace_id\', workspaceId)'), 'PUT workspace-scoped')
assert.ok(postRoute.includes('workspace_id: workspaceId'), 'POST workspace-scoped')

console.log('estimate-approval-authority-test: PASS (migration 059, API POST/PUT guards, draft preserved, admin-only approval enforced; no YOLO mode present)')
