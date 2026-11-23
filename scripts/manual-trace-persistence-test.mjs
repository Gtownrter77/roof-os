import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import ts from 'typescript'
import { isCertifiedPhotoContent } from '../lib/photo-provenance-integrity.mjs'
import { embedGpsIntoJpeg, readEmbeddedGps } from '../lib/photo-provenance.mjs'

// RED gate: name the missing feature rather than failing with an opaque ENOENT.
assert.ok(existsSync(new URL('../lib/measurements/manual-trace-input.ts', import.meta.url)),
  'missing lib/measurements/manual-trace-input.ts')
assert.ok(existsSync(new URL('../app/api/measurements/manual-trace/route.ts', import.meta.url)),
  'missing app/api/measurements/manual-trace/route.ts')

const nodeRequire = createRequire(import.meta.url)
function loadTypeScript(relativePath, imports = {}) {
  const source = readFileSync(new URL(relativePath, import.meta.url), 'utf8')
  const code = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      esModuleInterop: true,
    },
  }).outputText
  const loaded = { exports: {} }
  const localRequire = (name) => {
    if (Object.hasOwn(imports, name)) return imports[name]
    return nodeRequire(name)
  }
  new Function('require', 'module', 'exports', code)(localRequire, loaded, loaded.exports)
  return loaded.exports
}

const readJsonModule = loadTypeScript('../lib/read-json.ts')
const nextServer = {
  NextRequest: class NextRequest {},
  NextResponse: { json: (body, init) => ({ status: init?.status ?? 200, json: async () => body }) },
}
const apiSecurity = loadTypeScript('../lib/api-security.ts', {
  'next/server': nextServer,
  './read-json': readJsonModule,
})
const geometryContract = loadTypeScript('../lib/ai/geometry-contract.ts')
const manualTraceInput = loadTypeScript('../lib/measurements/manual-trace-input.ts', {
  '../ai/geometry-contract': geometryContract,
  '../ai/geometry-contract.ts': geometryContract,
  'next/server': nextServer,
})
const validate = manualTraceInput.validateManualTraceInput

const USER_ID = '11111111-1111-4111-8111-111111111111'
const WORKSPACE_ID = '22222222-2222-4222-8222-222222222222'
const INSPECTION_ID = '33333333-3333-4333-8333-333333333333'
const PHOTO_ID = '44444444-4444-4444-8444-444444444444'
const MEASUREMENT_ID = '55555555-5555-4555-8555-555555555555'
const SUPABASE_URL = 'https://validation.supabase.co'
const OBJECT_PATH = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/cccccccc-cccc-4ccc-8ccc-cccccccccccc/dddddddd-dddd-4ddd-8ddd-dddddddddddd.jpg'

function validBody(extra = {}) {
  return {
    inspectionId: INSPECTION_ID,
    photoId: PHOTO_ID,
    imageWidth: 1000,
    imageHeight: 800,
    scaleReferencePixels: 100,
    scaleReferenceFeet: 10,
    planes: [
      { vertices: [{ x: 10, y: 10 }, { x: 110, y: 10 }, { x: 110, y: 90 }, { x: 10, y: 90 }], pitchRisePer12: 4 },
      { vertices: [{ x: 200, y: 10 }, { x: 300, y: 10 }, { x: 300, y: 90 }, { x: 200, y: 90 }], pitchRisePer12: 6 },
    ],
    ...extra,
  }
}

// ---------------------------------------------------------------------------
// (1) Real behavioral tests of the pure input validator.
// ---------------------------------------------------------------------------
const normalized = validate(validBody())
assert.deepEqual(normalized, {
  inspectionId: INSPECTION_ID,
  photoId: PHOTO_ID,
  imageWidth: 1000,
  imageHeight: 800,
  scaleReferencePixels: 100,
  scaleReferenceFeet: 10,
  planes: [
    { vertices: [{ x: 10, y: 10 }, { x: 110, y: 10 }, { x: 110, y: 90 }, { x: 10, y: 90 }], pitchRisePer12: 4 },
    { vertices: [{ x: 200, y: 10 }, { x: 300, y: 10 }, { x: 300, y: 90 }, { x: 200, y: 90 }], pitchRisePer12: 6 },
  ],
}, 'a valid hand trace must normalize to the documented ManualTraceInput shape')
assert.ok(!('roofAreaSqft' in normalized) && !('roofSquares' in normalized),
  'client area fields must never appear in validated manual-trace input')

const withClientArea = validate(validBody({ roofAreaSqft: 99999, roofSquares: 999, pixelsPerFoot: 1 }))
assert.ok(!('roofAreaSqft' in withClientArea) && !('roofSquares' in withClientArea) && !('pixelsPerFoot' in withClientArea),
  'a client attempting to submit area or a client-computed scale must not influence validated input')

function rejects(body, pattern, message) {
  assert.throws(() => validate(body), (error) => error instanceof Error && pattern.test(error.message), message)
}
rejects({ ...validBody(), planes: [] }, /plane/i, 'at least one roof plane is required')
rejects({ ...validBody(), planes: [{ vertices: [{ x: 0, y: 0 }, { x: 10, y: 10 }], pitchRisePer12: null }] },
  /3/, 'a polygon with fewer than three vertices must be rejected')
rejects({ ...validBody(), planes: [{ vertices: [{ x: 1001, y: 10 }, { x: 200, y: 10 }, { x: 200, y: 90 }], pitchRisePer12: null }] },
  /bound/i, 'vertices outside the image bounds must be rejected')
rejects({ ...validBody(), planes: [{ vertices: [{ x: Number.NaN, y: 10 }, { x: 200, y: 10 }, { x: 200, y: 90 }], pitchRisePer12: null }] },
  /finite/i, 'non-finite vertices must be rejected')
rejects({ ...validBody(), planes: [{ vertices: [{ x: 0, y: 0 }, { x: 40, y: 40 }, { x: 0, y: 10 }, { x: 30, y: 0 }], pitchRisePer12: null }] },
  /intersect/i, 'a self-intersecting polygon with non-zero signed area must be rejected')
rejects({ ...validBody(), planes: [{ vertices: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 }], pitchRisePer12: null }] },
  /area/i, 'a zero-area polygon must be rejected')
rejects({ ...validBody(), planes: [{ vertices: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }], pitchRisePer12: 36.1 }] },
  /pitch/i, 'pitch above 36/12 must be rejected')
rejects({ ...validBody(), planes: [{ vertices: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }], pitchRisePer12: -1 }] },
  /pitch/i, 'negative pitch must be rejected')
rejects({ ...validBody(), planes: [{ vertices: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }], pitchRisePer12: Number.POSITIVE_INFINITY }] },
  /pitch|finite/i, 'non-finite pitch must be rejected')
rejects({ ...validBody(), scaleReferencePixels: 200001 }, /scale/i, 'scale pixels above 200000 must be rejected')
rejects({ ...validBody(), scaleReferenceFeet: 10001 }, /scale/i, 'scale feet above 10000 must be rejected')
rejects({ ...validBody(), scaleReferenceFeet: 0 }, /scale/i, 'a zero scale denominator must be rejected')
rejects({ ...validBody(), scaleReferencePixels: Number.NaN }, /finite|scale/i, 'non-finite scale must be rejected')
rejects({ ...validBody(), imageWidth: 0 }, /image|dimension/i, 'invalid image width must be rejected')
rejects({ ...validBody(), imageWidth: 1000.5 }, /image|dimension|integer/i,
  'non-integer image dimensions must be rejected')
rejects({ ...validBody(), photoId: 'not-a-uuid' }, /photo|uuid/i, 'photoId must be a UUID')
rejects({ ...validBody(), inspectionId: 'not-a-uuid' }, /inspection|uuid/i, 'inspectionId must be a UUID')
assert.equal(validate({ ...validBody(), planes: [{ vertices: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }], pitchRisePer12: null }] }).planes[0].pitchRisePer12,
  null, 'a null per-plane pitch is allowed')
rejects({ ...validBody(), planes: [{ vertices: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }] }] },
  /pitch|finite/i, 'a missing per-plane pitch key must be rejected, not defaulted')

// ---------------------------------------------------------------------------
// (2) Source contract: certified-photo checks, scoping, and no client area.
// ---------------------------------------------------------------------------
const routeSource = readFileSync(new URL('../app/api/measurements/manual-trace/route.ts', import.meta.url), 'utf8')
const validatorSource = readFileSync(new URL('../lib/measurements/manual-trace-input.ts', import.meta.url), 'utf8')
for (const [label, source] of [['route', routeSource], ['validator', validatorSource]]) {
  assert.doesNotMatch(source, /roofAreaSqft|roofSquares/, `${label} must not read or store client-supplied area`)
}
for (const fragment of [
  "from('inspection_photos')",
  ".eq('id', photoId)",
  ".eq('workspace_id', workspaceId)",
  ".eq('inspection_id', inspectionId)",
  "photo.bucket_id !== PHOTO_BUCKET",
  "photo.upload_status !== 'uploaded'",
  "photo.gps_verified !== true",
  'photo.gps_address',
  "createSignedUrl(photo.object_path, 60)",
  'isCertifiedPhotoContent(photo, bytes)',
  "measurement_source: 'manual_traced'",
  "calibration_status: 'calibrated'",
  'pixels_per_foot:',
  "is_suggested: false",
  "review_status: 'accepted'",
  "confidence: 'high'",
  'reviewed_pitch_rise_per_12:',
  'created_by: user.id',
]) {
  assert.ok(routeSource.includes(fragment), `route must contain ${fragment}`)
}
const releaseCheck = readFileSync(new URL('../scripts/release-check.mjs', import.meta.url), 'utf8')
assert.match(releaseCheck, /boundedManualTraceFetch/,
  'release-check must register the reviewed bounded-storage pattern for this route')
assert.match(releaseCheck, /!boundedManualTraceFetch/,
  'the new bounded-storage allowance must be wired into the release gate')
assert.doesNotMatch(routeSource, /enable_auto_photo_measurements/,
  'Manual is not an auto path and must not require the owner auto-measurement toggle')
assert.doesNotMatch(routeSource, /Manual tracing remains available/, 'stale no-GPS message must not be copied')
const certifiedIndex = routeSource.indexOf('isCertifiedPhotoContent(photo, bytes)')
const firstInsertIndex = routeSource.indexOf('.insert(')
assert.ok(certifiedIndex > 0 && firstInsertIndex > certifiedIndex,
  'certified byte verification must precede every insert')

// ---------------------------------------------------------------------------
// (3) Behavioral route tests with a stubbed Supabase client.
// ---------------------------------------------------------------------------
const baseJpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xd9])
const certifiedBytes = embedGpsIntoJpeg(baseJpeg, {
  latitude: 33.875321,
  longitude: -84.705123,
  address: '123 Certified Way, Testville, GA 30000',
  capturedAt: '2026-11-23T12:00:00.000Z',
})
const embeddedGps = readEmbeddedGps(certifiedBytes)
assert.ok(embeddedGps, 'the synthetic certified-photo fixture must carry embedded GPS')
const certifiedPhoto = {
  id: PHOTO_ID,
  workspace_id: WORKSPACE_ID,
  inspection_id: INSPECTION_ID,
  uploaded_by: USER_ID,
  bucket_id: 'inspection-photos',
  object_path: OBJECT_PATH,
  mime_type: 'image/jpeg',
  file_size_bytes: certifiedBytes.byteLength,
  upload_status: 'uploaded',
  gps_verified: true,
  gps_address: embeddedGps.address,
  gps_sha256: createHash('sha256').update(certifiedBytes).digest('hex'),
  gps_latitude: embeddedGps.latitude,
  gps_longitude: embeddedGps.longitude,
}
assert.equal(isCertifiedPhotoContent(certifiedPhoto, certifiedBytes), true, 'fixture must be certification-valid')
const tamperedBytes = Uint8Array.from([...certifiedBytes, 0x00])
assert.equal(isCertifiedPhotoContent(certifiedPhoto, tamperedBytes), false, 'fixture tampering must break certification')

const routeModuleSource = readFileSync(new URL('../app/api/measurements/manual-trace/route.ts', import.meta.url), 'utf8')
const routeCompiled = ts.transpileModule(routeModuleSource, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
}).outputText

function loadRoute(client, bytes, calls) {
  const imports = {
    'next/server': nextServer,
    'node:crypto': { createHash },
    '../../../../lib/photo-provenance-integrity.mjs': { isCertifiedPhotoContent },
    '../../../../lib/api-security': apiSecurity,
    '../../../../lib/supabase/env': { getSupabaseEnv: () => ({ url: SUPABASE_URL, anonKey: 'synthetic-test-key' }) },
    '../../../../lib/supabase/server': { createClient: async () => client },
    '../../../../lib/measurements/manual-trace-input': manualTraceInput,
  }
  const loaded = { exports: {} }
  const localRequire = (name) => Object.hasOwn(imports, name) ? imports[name] : nodeRequire(name)
  new Function('require', 'module', 'exports', routeCompiled)(localRequire, loaded, loaded.exports)
  return loaded.exports
}

async function scenario({ photo = certifiedPhoto, bytes = certifiedBytes, body = validBody() } = {}) {
  const calls = { filters: [], inserts: [], rpc: [], from: [], signed: [], fetches: [] }
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: USER_ID } } }) },
    rpc: async (name, args) => {
      calls.rpc.push([name, args])
      if (name === 'current_workspace_id') return { data: WORKSPACE_ID, error: null }
      if (name === 'is_workspace_member') return { data: true, error: null }
      throw new Error(`unexpected rpc call: ${name}`)
    },
    from: (table) => {
      calls.from.push(table)
      const state = { payload: null }
      const builder = {
        select: () => builder,
        eq: (column, value) => { calls.filters.push([table, column, value]); return builder },
        maybeSingle: async () => ({ data: table === 'inspection_photos' ? photo : null, error: null }),
        insert: (payload) => { state.payload = payload; calls.inserts.push({ table, payload }); return builder },
        single: async () => {
          if (table === 'aerial_measurements') {
            const payload = state.payload
            return {
              data: {
                id: MEASUREMENT_ID,
                measurement_source: payload.measurement_source,
                status: payload.status,
                calibration_status: payload.calibration_status,
              },
              error: null,
            }
          }
          return { data: null, error: null }
        },
        then: (resolve, reject) => {
          const result = table === 'roof_planes'
            ? { data: (Array.isArray(state.payload) ? state.payload : []).map((_, index) => ({ id: `plane-row-${index + 1}` })), error: null }
            : { data: null, error: null }
          return Promise.resolve(result).then(resolve, reject)
        },
      }
      return builder
    },
    storage: {
      from: (bucket) => ({
        createSignedUrl: async (objectPath, expiresIn) => {
          calls.signed.push([bucket, objectPath, expiresIn])
          return { data: { signedUrl: `${SUPABASE_URL}/storage/v1/object/sign/${objectPath}?token=synthetic` }, error: null }
        },
      }),
    },
  }
  const route = loadRoute(client, bytes, calls)
  const previousFetch = globalThis.fetch
  globalThis.fetch = async (url) => {
    calls.fetches.push(url)
    return new Response(bytes, { status: 200 })
  }
  try {
    const response = await route.POST(new Request('http://localhost/api/measurements/manual-trace', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }))
    return { response, calls, body: await response.json() }
  } finally {
    globalThis.fetch = previousFetch
  }
}

const happy = await scenario()
assert.equal(happy.response.status, 201, 'a certified hand trace must persist with 201')
assert.deepEqual(happy.body, {
  measurement: {
    id: MEASUREMENT_ID,
    measurement_source: 'manual_traced',
    status: 'draft',
    calibration_status: 'calibrated',
  },
}, 'the response must expose only the documented authoritative measurement fields')
assert.deepEqual(happy.calls.filters, [
  ['inspection_photos', 'id', PHOTO_ID],
  ['inspection_photos', 'workspace_id', WORKSPACE_ID],
  ['inspection_photos', 'inspection_id', INSPECTION_ID],
], 'the photo lookup must be scoped to workspace and inspection before reading bytes')
assert.equal(happy.calls.from.includes('workspace_settings'), false, 'Manual must never query the auto-toggle table')
assert.equal(happy.calls.signed.length, 1)
assert.equal(happy.calls.signed[0][0], 'inspection-photos', 'bytes must come from the private inspection-photos bucket')
assert.match(happy.calls.signed[0][1], /^[0-9a-f-]+\/[0-9a-f-]+\/[0-9a-f-]+\/[0-9a-f-]+\.jpe?g$/i)
assert.equal(happy.calls.fetches.length, 1, 'the stored image must be fetched for byte-level certification')
assert.equal(happy.calls.inserts.length, 2, 'exactly one measurement row and one batch of plane rows must be written')

const [measurementInsert, planeInsert] = happy.calls.inserts
assert.equal(measurementInsert.table, 'aerial_measurements')
assert.deepEqual(measurementInsert.payload, {
  workspace_id: WORKSPACE_ID,
  inspection_id: INSPECTION_ID,
  source_photo_id: PHOTO_ID,
  image_width: 1000,
  image_height: 800,
  status: 'draft',
  calibration_status: 'calibrated',
  measurement_source: 'manual_traced',
  scale_reference_pixels: 100,
  scale_reference_feet: 10,
  pixels_per_foot: 10,
  calibrated_by: USER_ID,
  calibrated_at: measurementInsert.payload.calibrated_at,
  created_by: USER_ID,
}, 'the measurement insert must carry server-derived scale and full workspace/creator scoping')
assert.match(measurementInsert.payload.calibrated_at, /^\d{4}-\d{2}-\d{2}T/, 'calibration time must be server generated')
assert.equal(planeInsert.table, 'roof_planes')
assert.equal(planeInsert.payload.length, 2)
for (const [index, row] of planeInsert.payload.entries()) {
  assert.equal(row.aerial_measurement_id, MEASUREMENT_ID)
  assert.equal(row.workspace_id, WORKSPACE_ID)
  assert.equal(row.created_by, USER_ID)
  assert.equal(row.is_suggested, false, 'a hand trace is not a suggestion')
  assert.equal(row.review_status, 'accepted')
  assert.equal(row.confidence, 'high')
  assert.equal(row.reviewed_pitch_rise_per_12, validBody().planes[index].pitchRisePer12)
  assert.deepEqual(row.vertices, validBody().planes[index].vertices)
  assert.match(row.source_image_reference, /^inspection-photo:.*:sha256:[a-f0-9]{64}$/, 'planes must cite certified image bytes')
}
assert.doesNotMatch(JSON.stringify(happy.calls.inserts), /roofAreaSqft|roofSquares/,
  'client area must never reach any insert payload')

const noGps = await scenario({ photo: { ...certifiedPhoto, gps_verified: false } })
assert.equal(noGps.response.status, 403, 'a no-GPS photo must be rejected for Manual tracing too')
assert.match(noGps.body.error, /GPS/i)
assert.doesNotMatch(noGps.body.error, /Manual tracing remains available/)
assert.equal(noGps.calls.signed.length, 0, 'the gate must precede private storage reads')
assert.equal(noGps.calls.inserts.length, 0, 'no measurement may be created for an uncertified photo')

const noAddress = await scenario({ photo: { ...certifiedPhoto, gps_address: '   ' } })
assert.equal(noAddress.response.status, 403, 'an empty GPS address must be rejected')
assert.equal(noAddress.calls.inserts.length, 0)

const tampered = await scenario({ bytes: tamperedBytes })
assert.equal(tampered.response.status, 403, 'photo bytes that no longer match their certification must be rejected')
assert.match(tampered.body.error, /no longer matches|reverify/i)
assert.equal(tampered.calls.fetches.length, 1, 'the stored bytes must actually be verified')
assert.equal(tampered.calls.inserts.length, 0, 'a stale certification must never be persisted')

const clientArea = await scenario({ body: validBody({ roofAreaSqft: 99999, roofSquares: 999 }) })
assert.equal(clientArea.response.status, 201, 'extra client area fields must be ignored, not trusted')
assert.doesNotMatch(JSON.stringify(clientArea.calls.inserts), /roofAreaSqft|roofSquares/)

const invalidGeometry = await scenario({
  body: { ...validBody(), planes: [{ vertices: [{ x: 2000, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 10 }], pitchRisePer12: null }] },
})
assert.equal(invalidGeometry.response.status, 400, 'invalid hand-traced geometry must be rejected before photo access')
assert.equal(invalidGeometry.calls.from.includes('inspection_photos'), false)
assert.equal(invalidGeometry.calls.inserts.length, 0)

// ---------------------------------------------------------------------------
// (4) Gate registration: exactly one new script and one web CI step; prior gates kept.
// ---------------------------------------------------------------------------
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
assert.equal(pkg.scripts['test:manual-trace-persistence'], 'node scripts/manual-trace-persistence-test.mjs')
for (const prior of ['test:manual-trace-doctrine', 'test:manual-trace-migration', 'test:manual-trace-recompute']) {
  assert.ok(pkg.scripts[prior], `prior gate ${prior} must be preserved`)
}
const ci = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8')
assert.equal(ci.split('npm run test:manual-trace-persistence').length - 1, 1,
  'exactly one web CI step must run the new gate')
for (const prior of ['test:manual-trace-doctrine', 'test:manual-trace-migration', 'test:manual-trace-recompute']) {
  assert.ok(ci.includes(`npm run ${prior}`), `CI must preserve ${prior}`)
}

console.log('manual-trace-persistence-test: PASS (validator bounds/geometry, certified-photo gate, scoped persistence, no client area, registered gate)')
