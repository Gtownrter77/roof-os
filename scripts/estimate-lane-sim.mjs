import assert from 'node:assert/strict'
import { draftEstimate, squaresFromVerified } from '../lib/ai/estimate-lane.ts'

assert.equal(squaresFromVerified({ eaveLf: 40, rafterLf: 20, pitch: 6, wasteFactor: 0.1 }), Number((40 * 20 * Math.sqrt(1 + 0.25) / 100 * 1.1).toFixed(2)))
const blocked = draftEstimate({ address: '3770 Hopkins', pitch: null, wasteFactor: null, soffitIn: null, fasciaIn: null, gateReady: false })
assert.equal(blocked.readyToSend, false)
assert.equal(blocked.requiresApproval, true)
const open = draftEstimate({ address: '3770 Hopkins', pitch: 6, wasteFactor: 0.1, soffitIn: 12, fasciaIn: 6, eaveLf: 40, rafterLf: 20, gateReady: true })
assert.equal(open.readyToSend, true)
assert.equal(open.options.length, 3)
console.log('estimate lane: gated')
