import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { analyzePhotosWithOllama, getOllamaVisionApiBaseUrl, getOllamaVisionModel, LocalVisionError } from '../lib/ai/local-vision.mjs'
import { analyzeRoofGeometryWithGemini, getGeminiVisionModel, GeminiVisionError } from '../lib/ai/gemini-vision.mjs'

const root = new URL('../', import.meta.url)
const photoRoute = readFileSync(new URL('app/api/photo-estimate/analyze/route.ts', root), 'utf8')
const aerialRoute = readFileSync(new URL('app/api/measurements/aerial/route.ts', root), 'utf8')
const aerialGeminiRoute = readFileSync(new URL('app/api/measurements/aerial/ai-suggest/route.ts', root), 'utf8')
const measurePage = readFileSync(new URL('app/measure/page.tsx', root), 'utf8')
const sidingRoute = readFileSync(new URL('app/api/siding/analyze/route.ts', root), 'utf8')
const browserVision = readFileSync(new URL('lib/ai/local-vision-browser.ts', root), 'utf8')
const helper = readFileSync(new URL('lib/ai/local-vision.mjs', root), 'utf8')
const workflowSchema = readFileSync(new URL('supabase/migrations/021_photo_estimate_workflows.sql', root), 'utf8')
const photoSchema = readFileSync(new URL('supabase/migrations/003_status_history_inspection_photos.sql', root), 'utf8')
const storagePolicy = readFileSync(new URL('supabase/migrations/033_storage_owner_path_hardening.sql', root), 'utf8')
const aiColumns = readFileSync(new URL('supabase/migrations/036_photo_estimate_ai_analysis.sql', root), 'utf8')
const updateGuard = readFileSync(new URL('supabase/migrations/027_photo_estimate_admin_guard.sql', root), 'utf8')

// Preserve the photo workflow's workspace, admin, private-storage, and data contract.
assert.ok(workflowSchema.includes('source_photo_ids text[]'))
assert.ok(photoSchema.includes('id uuid primary key'))
assert.ok(photoSchema.includes('inspection_id uuid not null'))
assert.ok(photoSchema.includes('uploaded_by uuid not null'))
assert.ok(photoSchema.includes('object_path text not null'))
assert.ok(photoSchema.includes('mime_type text not null'))
assert.ok(aiColumns.includes('ai_analysis jsonb'))
assert.ok(aiColumns.includes('ai_model_version text'))
assert.ok(updateGuard.includes('public.is_workspace_admin(workspace_id)'))
const membershipCheck = photoRoute.indexOf('requireWorkspaceMember(supabase, user.id, workspaceId)')
const adminCheck = photoRoute.indexOf("supabase.rpc('is_workspace_admin', { target_workspace: workspaceId })")
const workflowLookup = photoRoute.indexOf(".from('photo_estimate_workflows')")
const signedRead = photoRoute.indexOf('createSignedUrl(photo.object_path, 60)')
const visionCall = photoRoute.indexOf('analyzePhotosWithOllama(')
assert.ok(photoRoute.includes('supabase.auth.getUser()'))
assert.ok(membershipCheck >= 0 && adminCheck > membershipCheck && workflowLookup > adminCheck)
assert.ok(adminCheck < signedRead && adminCheck < visionCall, 'workspace admin authorization precedes private storage reads and local inference')
assert.ok(photoRoute.includes(".eq('id', workflowId)\n      .eq('workspace_id', workspaceId)"))
assert.ok(photoRoute.includes(".eq('workspace_id', workspaceId)\n      .eq('bucket_id', BUCKET)"))
assert.ok(photoRoute.includes('storage.from(BUCKET).createSignedUrl(photo.object_path, 60)'))
assert.ok(photoRoute.includes('signedUrl.origin !== supabaseOrigin'))
assert.ok(photoRoute.includes('validateRoofAIObservationPacket(candidatePacket, preparedPhotos.length)'))
assert.ok(photoRoute.includes('rejectUnsafeClaims(analysis)'))
assert.ok(photoRoute.includes('analysis.model_id !== MODEL_ID'))
assert.ok(photoRoute.includes('MAX_PHOTOS = 50'))
assert.ok(photoRoute.includes('MAX_TOTAL_BYTES = 30 * 1024 * 1024'))
assert.ok(photoRoute.includes('fetchBytesWithinBudget(signedUrl.toString(), remaining, deadline)'))

for (const [name, route] of [['photo estimate', photoRoute], ['siding analysis', sidingRoute]]) {
  assert.ok(route.includes('analyzePhotosWithOllama('), `${name} route uses local vision`)
  assert.ok(!route.includes('GEMINI_API_KEY'), `${name} route does not require Gemini credentials`)
  assert.ok(!route.includes('generativelanguage.googleapis.com'), `${name} route makes no hosted Gemini request`)
}
assert.ok(!aerialRoute.includes('analyzePhotosWithOllama('), 'aerial analysis does not resolve localhost on the hosted server')
assert.ok(aerialRoute.includes('validateGeometrySuggestion'), 'aerial route revalidates browser-supplied geometry before persistence')
assert.ok(browserVision.includes('NEXT_PUBLIC_OLLAMA_VISION_API_BASE_URL'))
assert.ok(browserVision.includes("'http://localhost:20128/v1'"))
assert.ok(browserVision.includes('LOCAL_HOSTS'))
assert.ok(browserVision.includes('/chat/completions'))
assert.ok(browserVision.includes('no hosted AI fallback is used'))
assert.ok(sidingRoute.includes('validateSidingVisionObservation'))
assert.ok(sidingRoute.includes('Manual measurement remains available'))
assert.ok(helper.includes("'http://localhost:20128/v1'"), 'the user-specified local API base is the default')
assert.ok(helper.includes('/chat/completions'), 'the configured /v1 base uses the OpenAI-compatible chat-completions path')
assert.ok(helper.includes('response_format: { type: \'json_object\' }'))
assert.ok(helper.includes('MAX_RESPONSE_BYTES'))

// Mock fetch: verify the exact request without contacting any external or local service.
const previousFetch = globalThis.fetch
const previousBase = process.env.OLLAMA_VISION_API_BASE_URL
const previousModel = process.env.OLLAMA_VISION_MODEL
try {
  process.env.OLLAMA_VISION_API_BASE_URL = 'http://localhost:20128/v1/'
  process.env.OLLAMA_VISION_MODEL = 'llava:test'
  let requestUrl
  let requestInit
  globalThis.fetch = async (url, init) => {
    requestUrl = url
    requestInit = init
    return new Response(JSON.stringify({
      model: 'llava:test',
      choices: [{ message: { content: '{"ok":true}' } }],
    }), { status: 200, headers: { 'content-type': 'application/json' } })
  }

  assert.equal(getOllamaVisionApiBaseUrl(), 'http://localhost:20128/v1')
  assert.equal(getOllamaVisionModel(), 'llava:test')
  const result = await analyzePhotosWithOllama({
    prompt: 'Return a JSON object.',
    photos: [{ mimeType: 'image/png', bytes: Buffer.from('fixture-image') }],
    timeoutMs: 1_000,
  })
  assert.equal(requestUrl, 'http://localhost:20128/v1/chat/completions')
  assert.equal(requestInit.method, 'POST')
  assert.equal(new Headers(requestInit.headers).get('content-type'), 'application/json')
  assert.equal(new Headers(requestInit.headers).get('authorization'), null, 'no hosted-provider credential is sent')
  const body = JSON.parse(requestInit.body)
  assert.equal(body.model, 'llava:test')
  assert.equal(body.stream, false)
  assert.deepEqual(body.response_format, { type: 'json_object' })
  assert.equal(body.messages[0].content[0].text, 'Return a JSON object.')
  assert.equal(body.messages[0].content[1].image_url.url, `data:image/png;base64,${Buffer.from('fixture-image').toString('base64')}`)
  assert.deepEqual(result, { model: 'llava:test', text: '{"ok":true}' })

  globalThis.fetch = async () => new Response('unavailable', { status: 503 })
  await assert.rejects(
    analyzePhotosWithOllama({ prompt: 'x', photos: [{ mimeType: 'image/jpeg', bytes: Buffer.from('x') }], timeoutMs: 1_000 }),
    (error) => error instanceof LocalVisionError && error.status === 503,
  )
} finally {
  globalThis.fetch = previousFetch
  if (previousBase === undefined) delete process.env.OLLAMA_VISION_API_BASE_URL
  else process.env.OLLAMA_VISION_API_BASE_URL = previousBase
  if (previousModel === undefined) delete process.env.OLLAMA_VISION_MODEL
  else process.env.OLLAMA_VISION_MODEL = previousModel
}

// Aerial geometry now runs through an authenticated server route and keeps the API key server-side.
assert.ok(aerialGeminiRoute.includes('analyzeRoofGeometryWithGemini('))
assert.ok(aerialGeminiRoute.includes('requireWorkspaceMember('))
assert.ok(aerialGeminiRoute.includes('createAdminClient()'))
assert.ok(aerialGeminiRoute.includes('consume_public_rate_limit'))
assert.ok(aerialGeminiRoute.includes('createSignedUrl(photo.object_path, 60)'))
assert.ok(aerialGeminiRoute.includes('signedUrl.origin !== storageOrigin'))
assert.ok(aerialGeminiRoute.includes('validateGeometrySuggestion(candidate)'))
assert.ok(aerialGeminiRoute.includes('rejectUnsafeClaims(suggestion)'))
assert.ok(!measurePage.includes('local-vision-browser'))
assert.ok(measurePage.includes('/api/measurements/aerial/ai-suggest'))
assert.ok(measurePage.includes('file.size > 12 * 1024 * 1024'))

const previousGeminiKey = process.env.GEMINI_API_KEY
const previousGeminiModel = process.env.GEMINI_VISION_MODEL
const previousPaidConfirmation = process.env.GEMINI_PAID_SERVICE_CONFIRMED
try {
  process.env.GEMINI_API_KEY = 'test-server-only-key'
  process.env.GEMINI_VISION_MODEL = 'gemini-test-model'
  delete process.env.GEMINI_PAID_SERVICE_CONFIRMED
  globalThis.fetch = async () => { throw new Error('Network must not be called before paid-service confirmation.') }
  await assert.rejects(
    analyzeRoofGeometryWithGemini({ prompt: 'x', photo: { mimeType: 'image/jpeg', bytes: Buffer.from('x') }, timeoutMs: 1_000 }),
    (error) => error instanceof GeminiVisionError && error.status === 503,
  )
  process.env.GEMINI_PAID_SERVICE_CONFIRMED = 'true'
  let geminiUrl
  let geminiInit
  globalThis.fetch = async (url, init) => {
    geminiUrl = String(url)
    geminiInit = init
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{\"ok\":true}' }] } }] }), { status: 200, headers: { 'content-type': 'application/json' } })
  }
  assert.equal(getGeminiVisionModel(), 'gemini-test-model')
  const geminiResult = await analyzeRoofGeometryWithGemini({
    prompt: 'Return a geometry JSON object.',
    photo: { mimeType: 'image/jpeg', bytes: Buffer.from('roof-image-fixture') },
    timeoutMs: 1_000,
  })
  assert.equal(geminiUrl, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-test-model:generateContent')
  assert.equal(new Headers(geminiInit.headers).get('x-goog-api-key'), 'test-server-only-key')
  assert.ok(!geminiUrl.includes('test-server-only-key'), 'Gemini key must never appear in the request URL')
  const geminiBody = JSON.parse(geminiInit.body)
  assert.equal(geminiBody.contents[0].parts[1].inlineData.mimeType, 'image/jpeg')
  assert.equal(geminiBody.contents[0].parts[1].inlineData.data, Buffer.from('roof-image-fixture').toString('base64'))
  assert.equal(geminiBody.generationConfig.responseMimeType, 'application/json')
  assert.deepEqual(geminiResult, { model: 'gemini-test-model', text: '{\"ok\":true}' })
  globalThis.fetch = async () => new Response('rate limited', { status: 429 })
  await assert.rejects(
    analyzeRoofGeometryWithGemini({ prompt: 'x', photo: { mimeType: 'image/png', bytes: Buffer.from('x') }, timeoutMs: 1_000 }),
    (error) => error instanceof GeminiVisionError && error.status === 429,
  )
} finally {
  if (previousGeminiKey === undefined) delete process.env.GEMINI_API_KEY
  else process.env.GEMINI_API_KEY = previousGeminiKey
  if (previousGeminiModel === undefined) delete process.env.GEMINI_VISION_MODEL
  else process.env.GEMINI_VISION_MODEL = previousGeminiModel
  if (previousPaidConfirmation === undefined) delete process.env.GEMINI_PAID_SERVICE_CONFIRMED
  else process.env.GEMINI_PAID_SERVICE_CONFIRMED = previousPaidConfirmation
}

console.log('ai-vision-endpoint-test: PASS (local photo/siding vision plus authenticated server-side Gemini aerial geometry)')
