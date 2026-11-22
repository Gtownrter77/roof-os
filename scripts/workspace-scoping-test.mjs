import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  assertSameWorkspace,
  foreignReferencesInWorkspace,
  resolveInspectionForUpload,
} from '../lib/scoping/workspace.ts'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')
const WS = 'ws-1'

// 41: a row loaded by an attacker-supplied id must be rejected unless its
// workspace_id matches the caller's resolved workspace.
assert.deepEqual(assertSameWorkspace({ id: 'i-1', workspace_id: WS }, WS), { id: 'i-1', workspace_id: WS })
assert.equal(assertSameWorkspace({ id: 'i-1', workspace_id: 'ws-2' }, WS), null, 'foreign rows must be rejected')
assert.equal(assertSameWorkspace(null, WS), null, 'missing rows fail closed')
assert.equal(assertSameWorkspace({ id: 'i-1', workspace_id: WS }, null), null, 'missing workspace fails closed')

// 42: a caller-supplied inspection id is only reusable if a scoped lookup
// found that id inside the caller's workspace.
const sessions = [{ id: 'mine', workspace_id: WS }, { id: 'theirs', workspace_id: 'ws-2' }]
assert.equal(resolveInspectionForUpload('mine', sessions, WS), 'mine')
assert.equal(resolveInspectionForUpload('theirs', sessions, WS), null, 'a foreign session id must never be reused')
assert.equal(resolveInspectionForUpload('missing', sessions, WS), null)
assert.equal(resolveInspectionForUpload('mine', [], WS), null)

// 43: both foreign keys written by siding/measure must resolve in the caller's
// workspace before the measurement is stored.
assert.equal(foreignReferencesInWorkspace({ id: 'i-1', workspace_id: WS }, { id: 'p-1', workspace_id: WS }, WS), true)
assert.equal(foreignReferencesInWorkspace({ id: 'i-1', workspace_id: WS }, { id: 'p-1', workspace_id: 'ws-2' }, WS), false)
assert.equal(foreignReferencesInWorkspace(null, { id: 'p-1', workspace_id: WS }, WS), false)

// Route wiring: each page/route must resolve a workspace and apply the helper
// before the cross-tenant-sensitive read or write.
const photoPage = read('../app/photo-estimate/page.tsx')
assert.match(photoPage, /rpc\('current_workspace_id'\)/, 'photo-estimate must resolve the caller workspace')
assert.match(photoPage, /\.eq\('workspace_id', workspaceId\)/, 'photo-estimate queries must be workspace-scoped')
assert.match(photoPage, /assertSameWorkspace\(/, 'photo-estimate must verify the loaded inspection belongs to the workspace')
assert.equal((photoPage.match(/\.eq\('workspace_id', workspaceId\)/g) ?? []).length >= 3, true, 'inspection, photos, and workflow queries must all be scoped')

const camera = read('../app/camera/page.tsx')
assert.match(camera, /resolveInspectionForUpload\(/, 'camera must verify a caller-supplied inspection id before reuse')

const siding = read('../app/api/siding/measure/route.ts')
assert.match(siding, /foreignReferencesInWorkspace\(/, 'siding/measure must verify foreign ids before writing')
assert.match(siding, /\.eq\('workspace_id', workspaceId\)/, 'siding/measure foreign-id lookups must be workspace-scoped')
assert.match(siding, /inspection_photos'\)[\s\S]*?\.eq\('inspection_id', b\.inspectionId\)/, 'the source photo must belong to the same inspection, not just the same workspace')

console.log('workspace-scoping-test: PASS (scoped row/id/foreign-ref helpers; photo-estimate, camera and siding wiring)')
