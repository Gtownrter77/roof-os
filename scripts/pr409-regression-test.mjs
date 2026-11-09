import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { fillPageFields } from '../lib/ai/page-filler.ts'
import { agentRefusal, layerAllows } from '../lib/layer-gate.ts'

const read = (path) => readFileSync(path, 'utf8')

const fills = fillPageFields('set notes to "Only the inspection note"', [
  { key: 'notes', label: 'Notes', value: '' },
  { key: 'summary', label: 'Summary', value: '' },
])
assert.deepEqual(fills, [{ key: 'notes', value: 'Only the inspection note' }], 'quoted notes must not spill into unrelated summary fields')

const chatRoute = read('app/api/ai/chat/route.ts')
assert.equal((chatRoute.match(/supabase\.rpc\('is_system_owner'/g) ?? []).length, 1, 'chat route must reuse one owner check')
assert.ok(chatRoute.includes("select('employee_layer,role')"), 'chat route must load the signed-in member employee layer')
assert.ok(chatRoute.includes('member?.employee_layer'), 'chat route must not collapse every non-owner into canvasser')
assert.equal(layerAllows('closer', 'estimate'), true, 'closers must retain estimate access')
assert.equal(agentRefusal('closer', 'create an estimate'), null, 'closers must not receive canvasser refusals for estimates')
assert.match(agentRefusal('canvasser', 'create an estimate') ?? '', /pricing and settings are closed/i)

const acceptRoute = read('app/api/team/invitations/accept/route.ts')
assert.ok(!acceptRoute.includes("from('workspace_invitations').select('employee_layer')"), 'acceptance must not reread the invite after the atomic RPC')
assert.ok(!acceptRoute.includes("from('workspace_members').update({ employee_layer"), 'acceptance must not perform a second non-transactional member write')
assert.ok(acceptRoute.includes('membership?.employee_layer'), 'acceptance must return the layer from the atomic RPC result')

const acceptanceMigration = 'supabase/migrations/084_invitation_employee_layer_atomic.sql'
assert.ok(existsSync(acceptanceMigration), 'employee layer acceptance migration must exist')
const migration = read(acceptanceMigration)
assert.ok(migration.includes('returns table (workspace_id uuid, role text, employee_layer text)'), 'acceptance RPC must return employee_layer')
assert.ok(migration.includes('employee_layer = excluded.employee_layer'), 'acceptance RPC must atomically write employee_layer')

const fieldApp = read('apps/field/App.tsx')
assert.ok(!fieldApp.includes('`/job/${selectedLeadId}`'), 'field bridge must not link to the nonexistent singular job route')
assert.ok(fieldApp.includes('`/jobs/${selectedLeadId}`'), 'field bridge must use the existing jobs route')

const chatBar = read('components/AiChatBar.tsx')
assert.ok(chatBar.includes('data.needsApproval !== true && data.yoloMode === true'), 'client must require explicit server approval state before auto-applying fills')

console.log('pr409-regression-test: PASS')
