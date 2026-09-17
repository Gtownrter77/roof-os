import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const photo = readFileSync('app/api/photo-estimate/route.ts', 'utf8')
const verify = readFileSync('app/api/photo-estimate/verify/route.ts', 'utf8')
const manual = readFileSync('app/api/measurements/manual/route.ts', 'utf8')
const intelligence = readFileSync('app/api/intelligence/property/route.ts', 'utf8')
const policy = readFileSync('DATA-QUALITY.md', 'utf8')
for (const marker of ['source_photo_ids', 'requiredReview', "status: 'report_review'", "source: 'OpenStreetMap building footprint assist'", "'low'"]) assert.ok(photo.includes(marker), marker)
for (const marker of ["action !== 'verify' && action !== 'refresh'", "decision: 'verified_by_technician'", 'Existing measurements and source photos were preserved.']) assert.ok(verify.includes(marker), marker)
for (const marker of ["source_type: 'manual'", "confidence: 'unverified'", 'created_by: user.id']) assert.ok(manual.includes(marker), marker)
assert.ok(intelligence.includes('not a certified inspection or vision model finding'))
for (const marker of ['workspace-isolated', 'technician review', 'unsafe-claim rate', 'data-quality-check.mjs']) assert.ok(policy.includes(marker), marker)
console.log('data-quality-check: PASS')
