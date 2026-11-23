import assert from 'node:assert/strict'
import { runPipeline, PIPELINE_STAGES } from '../workers/hover/pipeline.ts'
import { inferReconstruction } from '../lib/hover/reconstruction.ts'

const manifest = { jobId: 'job-1', workspaceId: 'ws-1', manifestHash: 'a'.repeat(64), images: [], anchors: [], createdAt: '2026-11-23T00:00:00.000Z' }
const adapter = (name, output, hooks = {}) => ({
  name, version: '1.0.0', available: () => true,
  run: (input, ctx) => { hooks.onRun?.(name, input, ctx); return output },
})

const seen = []
const adapters = Object.fromEntries(PIPELINE_STAGES.map((stage) => [
  stage, adapter(`adapter-${stage}`, { stage, hash: manifest.manifestHash }, { onRun: (name) => seen.push(name) }),
]))
const result = await runPipeline(manifest, adapters)
assert.equal(result.ok, true)
assert.deepEqual(result.stages.map((stage) => stage.stage), PIPELINE_STAGES)
assert.deepEqual(seen, PIPELINE_STAGES.map((stage) => `adapter-${stage}`))
for (const stage of result.stages) {
  assert.equal(stage.status, 'ok')
  assert.equal(stage.output.hash, manifest.manifestHash, 'every stage must receive the same immutable manifest hash')
}

const failed = await runPipeline(manifest, {
  ...adapters,
  scale: { name: 'broken', version: '1', available: () => true, run: () => { throw new Error('boom') } },
}, { maxRetries: 2 })
assert.equal(failed.ok, false)
assert.equal(failed.failedStage, 'scale')
assert.ok(failed.stages.find((stage) => stage.stage === 'scale').status === 'failed')
assert.equal(failed.stages.some((stage) => stage.stage === 'segment' && stage.status === 'ok'), false, 'later stages must not run')

let attempts = 0
const flaky = await runPipeline(manifest, {
  ...adapters,
  measure: {
    name: 'flaky', version: '1', available: () => true,
    run: () => { attempts++; if (attempts < 3) throw new Error('retry'); return { ok: true } },
  },
}, { maxRetries: 3 })
assert.equal(flaky.ok, true)
assert.equal(attempts, 3)

let unavailableRuns = 0
const unavailable = await runPipeline(manifest, {
  ...adapters,
  reconstruct: {
    name: 'colmap', version: '1', available: () => false,
    run: () => { unavailableRuns++; return { fabricated: true } },
  },
})
assert.equal(unavailableRuns, 0, 'unavailable adapter must never be invoked')
const skipped = unavailable.stages.find((stage) => stage.stage === 'reconstruct')
assert.equal(skipped.status, 'skipped')
assert.equal(skipped.output, null)
assert.match(skipped.error || '', /not available|unavailable/i)

const replay = await runPipeline(manifest, adapters)
assert.deepEqual(replay.stages.map((stage) => stage.output), result.stages.map((stage) => stage.output))

const reconstruction = inferReconstruction(manifest, [{ x: 0, y: 0, z: 0 }])
assert.equal(reconstruction.metricStatus, 'relative-only')
assert.equal(reconstruction.manifestHash, manifest.manifestHash)
assert.equal(reconstruction.meshUrl, null)
assert.equal(reconstruction.splatUrl, null)

console.log('hover-pipeline-test: PASS')
