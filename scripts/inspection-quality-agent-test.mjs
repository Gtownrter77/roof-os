import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const worker = readFileSync(new URL('../workers/inspection-quality.ts', import.meta.url), 'utf8')
const runtime = readFileSync(new URL('../workers/agent-runtime.ts', import.meta.url), 'utf8')
const cronRoute = readFileSync(new URL('../app/api/cron/inspection-quality/route.ts', import.meta.url), 'utf8')

assert.ok(worker.includes("agentKey: 'inspection_quality'"), 'inspection quality agent key must use the runtime contract')
assert.ok(worker.includes("trigger: 'inspection_quality_scan'"), 'inspection quality worker must have a deterministic trigger')
assert.ok(worker.includes("photo_presence"), 'worker must check photo presence')
assert.ok(worker.includes("upload_status"), 'worker must check upload status')
assert.ok(worker.includes("caption_presence"), 'worker must check missing captions')
assert.ok(worker.includes("duplicate_object_path"), 'worker must check duplicate object paths')
assert.ok(worker.includes("status: needsReview ? ('needs_review' as const) : ('succeeded' as const)"), 'worker must return needs_review when evidence is incomplete')
assert.ok(worker.includes('automation_key: `inspection-quality:${inspectionId}:${eventKey}`'), 'review tasks must use a deterministic automation key')
assert.ok(runtime.includes("eventKey"), 'runtime must expose the stable event key for idempotent review handling')
assert.ok(runtime.includes("event_key: event.eventKey"), 'runtime must persist the stable event key')
assert.ok(runtime.includes("status === 'succeeded' || existing?.status === 'needs_review'"), 'runtime must be idempotent for completed runs')
assert.ok(cronRoute.includes("return NextResponse.json({ processed, failed, failures }, { status: 500 })"), 'inspection cron must surface worker failures with a non-2xx response')
console.log('inspection-quality-agent-test: PASS')
