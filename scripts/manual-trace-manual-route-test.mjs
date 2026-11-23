import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import ts from 'typescript'

// Task 5 gate: the existing POST /api/measurements/manual route must accept
// manual_traced provenance and use the same server-side authority as
// ai_formulated, without weakening the already-approved AI path.

const ROUTE = new URL('../app/api/measurements/manual/route.ts', import.meta.url)
assert.ok(existsSync(ROUTE), 'missing app/api/measurements/manual/route.ts')
const routeSource = readFileSync(ROUTE, 'utf8')

const USER_ID = '11111111-1111-4111-8111-111111111111'
const WORKSPACE_ID = '22222222-2222-4222-8222-222222222222'
const INSPECTION_ID = '33333333-3333-4333-8333-333333333333'
const AERIAL_ID = '55555555-5555-4555-8555-555555555555'
const DERIVED = {
  acceptedPlaneCount: 2,
  pixelsPerFoot: 10,
  planAreaSqFt: 1100,
  roofAreaSqFt: 1234,
  // Deliberately different from the bundle-rounded purchasableRoofing squares
  // (12.6667) so the authoritative-squares condition is observable.
  roofSquares: 12.34,
  slopeMultiplier: 1.12,
  pitchRisePer12: 4,
}

const quadrilateral = (x) => [
  { x, y: 0 }, { x: x + 40, y: 0 }, { x: x + 40, y: 30 }, { x, y: 30 },
]
const PERSISTED_PLANES = [
  { vertices: quadrilateral(0), review_status: 'accepted', reviewed_pitch_rise_per_12: 4 },
  { vertices: quadrilateral(60), review_status: 'accepted', reviewed_pitch_rise_per_12: 4 },
  // Must never reach the authority: the aerial confirm path excludes rejected
  // planes and the helper marks every plane it receives accepted.
  { vertices: quadrilateral(200), review_status: 'rejected', reviewed_pitch_rise_per_12: 4 },
]

function confirmedAerial(measurementSource = 'manual_traced') {
  return {
    id: AERIAL_ID,
    inspection_id: INSPECTION_ID,
    measurement_source: measurementSource,
    status: 'confirmed',
    calibration_status: 'confirmed',
    orthographic_top_down_confirmed: true,
    uniform_pitch_confirmed: true,
    confirmed_uniform_pitch_rise_per_12: 4,
    scale_reference_pixels: 100,
    scale_reference_feet: 10,
    ai_formulation: measurementSource === 'ai_formulated'
      ? { confidence: 'medium', assumptions: ['synthetic'] }
      : null,
  }
}

// ---------------------------------------------------------------------------
// (1) Source contract: one parameterized branch, shared authority, no regressions.
// ---------------------------------------------------------------------------
for (const fragment of [
  "const isManualTraced = body.sourceType === 'manual_traced'",
  "const isFormulated = body.sourceType === 'ai_formulated'",
  'if (isManualTraced || isFormulated)',
  "isManualTraced ? 'manual-trace' : 'aerial-geometry'",
  "isManualTraced ? 'manual_traced' : 'ai_formulated'",
  "aerialMeasurement.measurement_source !== requiredSource",
  "aerialMeasurement.status !== 'confirmed'",
  "aerialMeasurement.calibration_status !== 'confirmed'",
  'aerialMeasurement.orthographic_top_down_confirmed !== true',
  ".eq('workspace_id', workspaceId).eq('aerial_measurement_id', aerialMeasurement.id)",
  ".filter(plane => plane.review_status !== 'rejected')",
  'recomputeAuthoritativeArea(',
  'clientAreaSqft: body.roofAreaSqft',
  'error instanceof RangeError && /stale/i.test(error.message)',
  'The displayed measurement is stale. Refresh the reviewed roof geometry.',
  "Saved geometry or pitch is unreviewed, inconsistent or overlapping.",
  "sourceType === 'ai_formulated' || sourceType === 'manual_traced'",
  'gutterLf = null; ridgeLf = null; eaveLf = null; rakeLf = null; valleyLf = null',
  "confidence = 'high'",
  "'AI-formulated measurements require a verified aerial measurement reference.'",
  'const formulatedConfidence = formulation?.confidence',
  "confidence = formulatedConfidence === 'low' || formulatedConfidence === 'medium' || formulatedConfidence === 'high' ? formulatedConfidence : 'unverified'",
]) {
  assert.ok(routeSource.includes(fragment), `manual route must contain ${fragment}`)
}
assert.ok(!routeSource.includes('calculateCalibratedRoofDraft('),
  'the shared helper must own the authority; the inline calculator call must be gone')
assert.doesNotMatch(routeSource, /stale\. Refresh the reviewed roof geometry\.'\s*\)\s*\n\s*\}\s*\n\s*\/\//,
  'the duplicate inline stale check must be removed in favour of the helper')
assert.ok(routeSource.includes("'manual-trace'") && routeSource.includes("'aerial-geometry'"),
  'both source-reference prefixes must be present')

const nodeRequire = createRequire(import.meta.url)
function loadTypeScript(relativePath, imports = {}) {
  const source = readFileSync(new URL(relativePath, import.meta.url), 'utf8')
  const code = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText
  const loaded = { exports: {} }
  const localRequire = (name) => Object.hasOwn(imports, name) ? imports[name] : nodeRequire(name)
  new Function('require', 'module', 'exports', code)(localRequire, loaded, loaded.exports)
  return loaded.exports
}

const nextServer = {
  NextRequest: class NextRequest {},
  NextResponse: { json: (body, init) => ({ status: init?.status ?? 200, json: async () => body }) },
}
const readJsonModule = loadTypeScript('../lib/read-json.ts')
const apiSecurity = loadTypeScript('../lib/api-security.ts', {
  'next/server': nextServer,
  './read-json': readJsonModule,
})
const purchasableRoofing = loadTypeScript('../lib/measurements/purchasable-roofing.ts')
// Kept as a fixture so behavior scenarios still execute against a partially
// reverted route; the source assertion above is what rejects the old inline path.
const legacyCalculator = { calculateCalibratedRoofDraft: () => DERIVED }
const routeCompiled = ts.transpileModule(readFileSync(ROUTE, 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
}).outputText

function loadRoute(client, helperCalls, helperError = null) {
  const helper = (input) => {
    helperCalls.push(input)
    if (helperError) throw helperError
    return DERIVED
  }
  const imports = {
    'next/server': nextServer,
    '../../../../lib/measurements/purchasable-roofing': purchasableRoofing,
    '../../../../lib/measurements/calibrated-roof-draft': legacyCalculator,
    '../../../../lib/measurements/authoritative-recompute': { recomputeAuthoritativeArea: helper },
    '../../../../lib/supabase/server': { createClient: async () => client },
    '../../../../lib/api-security': apiSecurity,
  }
  const loaded = { exports: {} }
  const localRequire = (name) => Object.hasOwn(imports, name) ? imports[name] : nodeRequire(name)
  new Function('require', 'module', 'exports', routeCompiled)(localRequire, loaded, loaded.exports)
  return loaded.exports
}

function scenario({
  sourceType = 'manual_traced',
  sourceReference = `manual-trace:${AERIAL_ID}`,
  aerial = confirmedAerial('manual_traced'),
  planes = PERSISTED_PLANES,
  helperError = null,
  bodyExtra = {},
} = {}) {
  const calls = { filters: [], from: [], rpc: [], helper: [], insert: null }
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: USER_ID } } }) },
    rpc: async (name) => {
      calls.rpc.push(name)
      if (name === 'current_workspace_id') return { data: WORKSPACE_ID, error: null }
      if (name === 'is_workspace_member') return { data: true, error: null }
      throw new Error(`unexpected rpc: ${name}`)
    },
    from: (table) => {
      calls.from.push(table)
      const state = { payload: null }
      const builder = {
        select: () => builder,
        eq: (column, value) => { calls.filters.push([table, column, value]); return builder },
        maybeSingle: async () => ({
          data: table === 'aerial_measurements' ? aerial
            : table === 'inspection_sessions' ? { id: INSPECTION_ID } : null,
          error: null,
        }),
        insert: (payload) => { state.payload = payload; calls.insert = { table, payload }; return builder },
        single: async () => ({ data: state.payload ? { id: '99999999-9999-4999-8999-999999999999', ...state.payload } : null, error: null }),
        then: (resolve, reject) => Promise.resolve({ data: table === 'roof_planes' ? planes : null, error: null }).then(resolve, reject),
      }
      return builder
    },
  }
  const route = loadRoute(client, calls.helper, helperError)
  const body = {
    inspectionId: INSPECTION_ID,
    roofAreaSqft: DERIVED.roofAreaSqFt,
    roofSquares: 99,
    gutterLf: 44,
    ridgeLf: 22,
    eaveLf: 88,
    rakeLf: 33,
    valleyLf: 11,
    pitch: '4/12',
    notes: 'client note',
    sourceType,
    sourceReference,
    ...bodyExtra,
  }
  return route.POST(new Request('http://localhost/api/measurements/manual', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })).then(async (response) => ({ response, calls, payload: await response.json(), body }))
}

function assertSharedHelperCall(calls, message) {
  assert.equal(calls.helper.length, 1, message)
  const input = calls.helper[0]
  assert.equal(input.clientAreaSqft, DERIVED.roofAreaSqFt, `${message}: client area must be supplied for stale rejection`)
  assert.equal(input.planes.length, 2, `${message}: rejected planes must be filtered before the helper`)
  assert.deepEqual(input.planes.map((plane) => plane.vertices), PERSISTED_PLANES.slice(0, 2).map((plane) => plane.vertices))
  assert.equal(input.uniformPitchRisePer12, 4)
  assert.equal(input.uniformPitchConfirmed, true)
  assert.equal(input.scaleReferencePixels, 100)
  assert.equal(input.scaleReferenceFeet, 10)
}

// ---------------------------------------------------------------------------
// (2) manual_traced authority.
// ---------------------------------------------------------------------------
const traced = await scenario()
assert.equal(traced.response.status, 201, `manual_traced must save: ${JSON.stringify(traced.payload)}`)
assert.equal(traced.calls.insert.table, 'inspection_measurements')
const tracedRow = traced.calls.insert.payload
assert.equal(tracedRow.source_type, 'manual_traced')
assert.equal(tracedRow.confidence, 'high', 'a confirmed hand trace carries high confidence')
assert.equal(tracedRow.roof_area_sqft, DERIVED.roofAreaSqFt)
assert.equal(tracedRow.roof_squares, DERIVED.roofSquares,
  'authoritative derived squares must win over client/bundle-rounded squares')
assert.equal(tracedRow.source_reference, `manual-trace:${AERIAL_ID}`)
assert.equal(tracedRow.pitch, '4/12')
for (const column of ['gutter_lf', 'ridge_lf', 'eave_lf', 'rake_lf', 'valley_lf']) {
  assert.equal(tracedRow[column], null, `${column} must be nulled for manual_traced`)
}
assert.doesNotMatch(tracedRow.notes, /AI|aerial-geometry|formulat/i,
  'manual_traced notes must not claim AI provenance')
assert.doesNotMatch(tracedRow.notes, /\$|USD|dollar/i, 'notes must not carry dollar amounts')
assertSharedHelperCall(traced.calls, 'manual_traced')

const tracedMixed = await scenario({ aerial: { ...confirmedAerial('manual_traced'), uniform_pitch_confirmed: false } })
assert.equal(tracedMixed.response.status, 201)
assert.equal(tracedMixed.calls.insert.payload.pitch, 'mixed', 'mixed pitch must be preserved')
assert.equal(tracedMixed.calls.insert.payload.confidence, 'high')

// provenance, prefix and attestation gates apply to manual_traced too.
for (const [label, overrides, status, pattern] of [
  ['unknown reference', { sourceReference: `aerial-geometry:${AERIAL_ID}` }, 400, /verified manual trace reference/i],
  ['wrong source', { aerial: confirmedAerial('ai_formulated') }, 400, /not valid for this workspace/i],
  ['unconfirmed status', { aerial: { ...confirmedAerial(), status: 'draft' } }, 409, /Reviewed, calibrated and confirmed/i],
  ['unconfirmed calibration', { aerial: { ...confirmedAerial(), calibration_status: 'calibrated' } }, 409, /Reviewed, calibrated and confirmed/i],
  ['no top-down', { aerial: { ...confirmedAerial(), orthographic_top_down_confirmed: false } }, 409, /Reviewed, calibrated and confirmed/i],
]) {
  const result = await scenario(overrides)
  assert.equal(result.response.status, status, `manual_traced ${label} must be rejected`)
  assert.match(result.payload.error, pattern)
  assert.equal(result.calls.insert, null, `manual_traced ${label} must not insert`)
}

const tracedProvisional = await scenario({ bodyExtra: { provisionalGeometryDraft: true } })
assert.equal(tracedProvisional.response.status, 400, 'provisional drafts remain AI-only')
assert.equal(tracedProvisional.calls.insert, null)

const tracedStale = await scenario({ helperError: new RangeError('The client area is stale: 5 sq ft.') })
assert.equal(tracedStale.response.status, 409)
assert.equal(tracedStale.payload.error, 'The displayed measurement is stale. Refresh the reviewed roof geometry.',
  'the existing stale message must be preserved')
const tracedBadGeometry = await scenario({ helperError: new RangeError('Roof plane polygon overlaps itself.') })
assert.equal(tracedBadGeometry.response.status, 409)
assert.equal(tracedBadGeometry.payload.error, 'Saved geometry or pitch is unreviewed, inconsistent or overlapping.',
  'non-stale helper errors keep the existing message')

// ---------------------------------------------------------------------------
// (3) ai_formulated path is preserved, but shares the new authority.
// ---------------------------------------------------------------------------
const formulated = await scenario({
  sourceType: 'ai_formulated',
  sourceReference: `aerial-geometry:${AERIAL_ID}`,
  aerial: confirmedAerial('ai_formulated'),
})
assert.equal(formulated.response.status, 201, `ai_formulated must still save: ${JSON.stringify(formulated.payload)}`)
const formulatedRow = formulated.calls.insert.payload
assert.equal(formulatedRow.source_type, 'ai_formulated')
assert.equal(formulatedRow.confidence, 'medium', 'formulation confidence must be preserved')
assert.equal(formulatedRow.roof_squares, DERIVED.roofSquares)
assert.equal(formulatedRow.source_reference, `aerial-geometry:${AERIAL_ID}`)
assert.match(formulatedRow.notes, /persisted reviewed polygons/)
assert.match(formulatedRow.notes, /AI|Unverified draft/)
assertSharedHelperCall(formulated.calls, 'ai_formulated')
assert.equal(formulated.payload.warning, 'AI-formulated measurement saved with provenance.')

const formulatedProvisional = await scenario({
  sourceType: 'ai_formulated',
  sourceReference: `aerial-geometry:${AERIAL_ID}`,
  aerial: confirmedAerial('ai_formulated'),
  bodyExtra: { provisionalGeometryDraft: true },
})
assert.equal(formulatedProvisional.response.status, 201, 'provisional geometry drafts must remain accepted for AI')
assertSharedHelperCall(formulatedProvisional.calls, 'ai_formulated provisional')
assert.equal(formulatedProvisional.calls.filters.some(([table, column]) => table === 'aerial_measurements' && column === 'id'), true,
  'the AI reference must still be resolved against the aerial measurement row')

for (const [label, overrides, status] of [
  ['unknown reference', { sourceType: 'ai_formulated', sourceReference: `manual-trace:${AERIAL_ID}` }, 400],
  ['wrong source', { sourceType: 'ai_formulated', sourceReference: `aerial-geometry:${AERIAL_ID}`, aerial: confirmedAerial('manual_traced') }, 400],
  ['unconfirmed status', { sourceType: 'ai_formulated', sourceReference: `aerial-geometry:${AERIAL_ID}`, aerial: { ...confirmedAerial('ai_formulated'), status: 'draft' } }, 409],
]) {
  const result = await scenario(overrides)
  assert.equal(result.response.status, status, `ai_formulated ${label} must be rejected`)
  assert.equal(result.calls.insert, null)
}

// ---------------------------------------------------------------------------
// (4) Legacy manual stays client-entered and never touches the authority.
// ---------------------------------------------------------------------------
const legacy = await scenario({
  bodyExtra: { roofAreaSqft: 700, roofSquares: 99, sourceType: undefined, sourceReference: undefined },
})
assert.equal(legacy.response.status, 201, `legacy manual must still save: ${JSON.stringify(legacy.payload)}`)
assert.equal(legacy.calls.helper.length, 0, 'legacy manual must not call the shared authority')
assert.equal(legacy.calls.from.includes('aerial_measurements'), false)
assert.equal(legacy.calls.insert.payload.source_type, 'manual')
assert.equal(legacy.calls.insert.payload.roof_squares, 7, 'bundle-rounded client squares remain the legacy rule')
assert.equal(legacy.calls.insert.payload.confidence, 'unverified')

// ---------------------------------------------------------------------------
// (5) Gate registration: exactly one new script and one web CI step.
// ---------------------------------------------------------------------------
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
assert.equal(pkg.scripts['test:manual-trace-manual-route'], 'node scripts/manual-trace-manual-route-test.mjs')
for (const prior of ['test:manual-trace-doctrine', 'test:manual-trace-migration', 'test:manual-trace-recompute', 'test:manual-trace-persistence']) {
  assert.ok(pkg.scripts[prior], `prior gate ${prior} must be preserved`)
}
const ci = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8')
assert.equal(ci.split('npm run test:manual-trace-manual-route').length - 1, 1,
  'exactly one web CI step must run the new gate')
for (const prior of ['test:manual-trace-doctrine', 'test:manual-trace-migration', 'test:manual-trace-recompute', 'test:manual-trace-persistence']) {
  assert.ok(ci.includes(`npm run ${prior}`), `CI must preserve ${prior}`)
}

console.log('manual-trace-manual-route-test: PASS (shared authority, both prefixes, rejected-plane filter, attestation, high confidence, null edges, preserved AI path)')
