import assert from 'node:assert/strict'
import { draftProduction } from '../lib/ai/production-lane.ts'

const blocked = draftProduction({ address: '3770 Hopkins', squares: null, gutterLf: null, soffitIn: null, fasciaIn: null, estimateApproved: false })
assert.equal(blocked.ready, false)
assert.equal(blocked.requiresApproval, true)
const open = draftProduction({ address: '3770 Hopkins', squares: 28, gutterLf: 160, soffitIn: 12, fasciaIn: 6, estimateApproved: true })
assert.equal(open.ready, true)
assert.ok(open.materials.some((line) => line.trade === 'roof' && line.qty === '28 sq'))
console.log('production lane: gated')
