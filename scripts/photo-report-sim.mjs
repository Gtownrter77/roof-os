import assert from 'node:assert/strict'
import { classifyTestSquare, draftPhoto, draftPhotoReport, coverageChecklist } from '../lib/ai/photo-report.ts'

assert.equal(classifyTestSquare(9).band, 'functional')
assert.equal(classifyTestSquare(5).band, 'moderate')
assert.equal(classifyTestSquare(1).band, 'cosmetic')
assert.equal(classifyTestSquare(null).band, 'unmarked')

const front = draftPhoto({ id: '1', name: 'front-elevation.jpg', notes: 'street view hail bruises gutter dents test square 10x10 coin scale', width: 3000, height: 2000, bytes: 400_000 })
assert.equal(front.quality, 'good')
assert.equal(front.requiresApproval, true)

const report = draftPhotoReport('3770 Hopkins', [front], 'hail bruises and gutter dents, siding impact, attic stain, test square 10x10', 9)
assert.equal(report.version, 'photo-report-draft-v2')
assert.equal(report.sections.length, 12)
assert.equal(report.testSquare.band, 'functional')
assert.ok(report.coverageScore > 20)
assert.ok(report.damages.some((d) => d.trade === 'roof'))
assert.ok(report.damages.some((d) => d.trade === 'interior'))
assert.ok(coverageChecklist('front back left right', []).some((item) => item.id === 'front' && item.done))
assert.equal(report.requiresApproval, true)

console.log('photo-report v2: insurance-grade drafts gated')

import { gatePhotoReport } from '../lib/ai/photo-report.ts'
const blocked = gatePhotoReport({ coverageScore: 20, missing: ['Marked 10x10 test square'], addressBand: 'low', pitch: null, wasteFactor: null, soffitIn: null, fasciaIn: null })
assert.equal(blocked.ready, false)
assert.ok(blocked.blockers.length >= 4)
const open = gatePhotoReport({ coverageScore: 80, missing: [], addressBand: 'high', pitch: 6, wasteFactor: 0.1, soffitIn: 12, fasciaIn: 6 })
assert.equal(open.ready, true)
console.log('photo-report gate: blockers hold the send')
