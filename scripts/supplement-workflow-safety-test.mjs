import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { allowedSupplementTransition } from '../lib/supplement-workflow.ts'

// 75: the legacy admin PATCH must obey the same review state machine as the
// guarded review route — approval is terminal for this path.
assert.equal(allowedSupplementTransition('needs_review', 'approved'), true)
assert.equal(allowedSupplementTransition('needs_review', 'rejected'), true)
assert.equal(allowedSupplementTransition('rejected', 'needs_review'), true, 'a rejected draft may be reopened')
assert.equal(allowedSupplementTransition('approved', 'needs_review'), false, 'an approved supplement must not be regressed')
assert.equal(allowedSupplementTransition('approved', 'approved'), false, 're-approval must be rejected')
assert.equal(allowedSupplementTransition('rejected', 'approved'), false, 'a rejected draft must go through reopening')
assert.equal(allowedSupplementTransition(undefined, 'approved'), false, 'an unknown status cannot transition')

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')
const patchSource = read('../app/api/supplements/route.ts')
const patch = patchSource.slice(patchSource.indexOf('export async function PATCH'))
assert.ok(patch.includes('isUuid(body.id)'), 'PATCH must validate the supplement id as a UUID')
assert.ok(patch.includes('allowedSupplementTransition('), 'PATCH must enforce the review transition allow-list')
assert.ok(patch.includes(".eq('status', existing.status)"), 'PATCH must compare-and-swap the observed status')
const casUpdate = patch.slice(patch.indexOf('.update({ status: target'), patch.indexOf("Could not update supplement"))
assert.ok(casUpdate.includes('.maybeSingle()'), 'a 0-row CAS race must yield data:null (409), not a PGRST116 error (502) from .single()')
assert.ok(/status: 409/.test(patch), 'an invalid or raced transition must return 409')

// 78: a failed lead-status write after the report commit must not be hidden.
const report = read('../app/api/photo-estimate/report/route.ts')
const leadWrite = report.slice(report.indexOf('if (row.lead_id) {'), report.indexOf('return NextResponse.json({ workflow'))
assert.ok(leadWrite.includes('leadError'), 'the leads update result must be checked')
assert.ok(/502/.test(leadWrite), 'a failed lead write must surface as a server error')
assert.ok(leadWrite.includes(".in('status'"), 'the lead update must guard against regressing advanced statuses')

console.log('supplement-workflow-safety-test: PASS (supplement transitions guarded, lead status write checked)')
