import assert from 'node:assert/strict'
import { draftPhoto, draftPhotoReport, missingElevations, scorePhotoQuality } from '../lib/ai/photo-report.ts'

assert.equal(scorePhotoQuality(3000, 2000, 400_000), 'good')
assert.equal(scorePhotoQuality(400, 300, 20_000), 'poor')

const front = draftPhoto({ id: '1', name: 'front-curb.jpg', notes: 'hail on shingles', width: 3000, height: 2000, bytes: 400_000 })
assert.equal(front.elevation, 'front')
assert.equal(front.quality, 'good')
assert.equal(front.requiresApproval, true)

const report = draftPhotoReport('3770 Hopkins', [front], 'hail bruises and gutter dents, siding impact')
assert.ok(report.missingElevations.includes('back'))
assert.ok(report.damages.some((d) => d.trade === 'roof' && d.category === 'hail'))
assert.ok(report.damages.some((d) => d.trade === 'gutters'))
assert.equal(report.requiresApproval, true)
assert.equal(missingElevations([front]).length, 3)

console.log('photo-report: drafts gated')
