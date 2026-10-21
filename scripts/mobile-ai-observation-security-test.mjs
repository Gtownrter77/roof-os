import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const migration = readFileSync('supabase/migrations/054_mobile_ai_observations.sql', 'utf8')
const inference = readFileSync('apps/field/src/ai/inference.ts', 'utf8')
const review = readFileSync('apps/field/src/ai/review.ts', 'utf8')

for (const marker of [
  "create policy inspection_ai_observations_update",
  "auth.uid() = created_by or public.is_workspace_admin(workspace_id)",
  'AI observation provenance is immutable after insertion',
  'AI observation and inspection must belong to the same workspace',
  'AI observation and source photo must belong to the same workspace',
  "review_status = 'rejected' and reviewer_value is null",
  "review_status = 'corrected' and reviewer_value is not null",
  'reviewed_by = auth.uid()',
  'unique (workspace_id, client_id)',
]) assert.ok(migration.includes(marker), `migration security marker missing: ${marker}`)

for (const marker of ['validateInferenceInput', 'validateInferenceResult', 'runtimeAvailable', 'modelLoaded', 'return null']) {
  assert.ok(inference.includes(marker), `inference safety marker missing: ${marker}`)
}
for (const marker of ['validateAiReviewState', '1000 characters or fewer', 'canBecomeMeasurementCandidate']) {
  assert.ok(review.includes(marker), `review safety marker missing: ${marker}`)
}

console.log('mobile-ai-observation-security-test: PASS')
