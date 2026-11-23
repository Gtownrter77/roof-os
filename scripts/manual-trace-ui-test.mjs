import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

// Task 6 gate: the dedicated /measure/mashup page offers two DISTINCT uses —
// an Auto (Roofr-like) use that delegates to the unchanged existing path, and
// a Manual (RoofSnap-like) hand-trace use that feeds the Task 4/5 pipeline.
// This is a source-contract gate over the two new UI files plus the additive
// onPlanesChange bridge on the existing ManualDrawingTool.

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')
const PAGE = '../app/measure/mashup/page.tsx'
const FORM = '../components/RoofrRoofsnapForm.tsx'
const TRACER = '../components/ManualDrawingTool.tsx'

for (const file of [PAGE, FORM, TRACER]) {
  assert.ok(existsSync(new URL(file, import.meta.url)), `missing ${file.replace('../', '')}`)
}
const page = read(PAGE)
const form = read(FORM)
const tracer = read(TRACER)
const combined = `${page}\n${form}`

// ---------------------------------------------------------------------------
// 1. Client page wrapper: Suspense boundary around the hook-using inner page.
// ---------------------------------------------------------------------------
assert.match(page, /^'use client'/m, 'mashup page must be a client page')
assert.ok(page.includes('<Suspense'), 'page must wrap the search-param consumer in Suspense')
assert.ok(page.includes('fallback='), 'Suspense must declare a fallback')
assert.ok(page.includes('useSearchParams'), 'inner page must call useSearchParams')
assert.ok(page.includes("search.get('photoId')"), 'photoId comes from the query string only')
assert.ok(page.includes("search.get('inspectionId')"), 'inspectionId comes from the query string only')
assert.ok(page.includes('<MashupInner />'), 'default export must render the Suspense-wrapped inner component')
assert.ok(page.includes('export default function'), 'page must export a default component')
assert.ok(!/placeholder=["']Enter (?:a )?property address/i.test(combined), 'no typed address intake')

// ---------------------------------------------------------------------------
// 2. Two separate uses, one certified-photo header, no blended authority UI.
// ---------------------------------------------------------------------------
for (const fragment of [
  "type MashupMode = 'auto' | 'manual'",
  "useState<MashupMode>('manual')",
  "setMode('auto')",
  "setMode('manual')",
  "mode === 'auto' && (",
  "mode === 'manual' && (",
  '<AutoMeasurementTool',
  '<ManualDrawingTool',
  'onPlanesChange={setPlanes}',
  'onAreaCalculated=',
  'provenance',
  'gpsVerified',
  'certified photo',
]) {
  assert.ok(form.includes(fragment), `form must contain ${fragment}`)
}
assert.equal(form.split('<AutoMeasurementTool').length - 1, 1, 'Auto tool is rendered in exactly one branch')
assert.equal(form.split('<ManualDrawingTool').length - 1, 1, 'Manual tracer is rendered in exactly one branch')

// ---------------------------------------------------------------------------
// 3. Auto use gates on verified GPS provenance + owner toggle; no GPS = evidence only.
// ---------------------------------------------------------------------------
for (const fragment of [
  "fetch('/api/photo-provenance/verify'",
  'const canMeasure = provenance?.gpsVerified === true',
  'const canAuto = canMeasure && provenance?.autoMeasurementsAllowed === true',
  'autoMeasurementsAllowed',
  'Evidence only',
]) {
  assert.ok(form.includes(fragment), `auto gating must contain ${fragment}`)
}
assert.ok(!/enable_auto_photo_measurements/.test(form), 'the owner toggle is owned by the provenance API, not re-read by the UI')

// ---------------------------------------------------------------------------
// 4. Manual attest chain: trace -> confirm ONLY -> save. No duplicate calibrate.
// ---------------------------------------------------------------------------
const traceIndex = form.indexOf("fetch('/api/measurements/manual-trace'")
const confirmIndex = form.indexOf("action: 'confirm'")
const saveIndex = form.indexOf("fetch('/api/measurements/manual'")
assert.ok(traceIndex >= 0, 'manual flow must POST the hand trace')
assert.ok(confirmIndex > traceIndex, 'confirm attestation must follow the persisted trace')
assert.ok(saveIndex > confirmIndex, 'the manual measurement save must follow the attest')
for (const fragment of [
  'method: \'POST\'',
  'scaleReferencePixels',
  'scaleReferenceFeet',
  'pitchRisePer12:',
  'orthographicTopDownConfirmed: true',
  'uniformPitchConfirmed,',
  'pitchRisePer12: uniformPitchConfirmed ? pitchValue : undefined',
  'aerialMeasurementId: traceId',
  "sourceType: 'manual_traced'",
  '`manual-trace:${traceId}`',
  'roofAreaSqft:',
  'pitch:',
]) {
  assert.ok(form.includes(fragment), `manual chain must contain ${fragment}`)
}
assert.ok(!form.includes("action: 'calibrate'"), 'Task 4 persists calibration; do NOT duplicate a calibrate call')
assert.ok(!/calibration_status\s*:/.test(form), 'the client must not fabricate or send calibration state')
assert.ok(!form.includes('provisionalGeometryDraft'), 'hand traces are authoritative geometry, not an AI provisional draft')

// Client area is a stale-rejection preview only; the server recomputes authority.
assert.ok(form.includes('setPreviewAreaSqft('), 'the provisional onAreaCalculated value is kept only as a preview')
assert.ok(form.includes('roofAreaSqft: previewAreaSqft?.squareFeet ?? null'),
  'only the provisional preview area is sent, never a client-authoritative quantity')
assert.ok(!/(slopeMultiplier|Math\.sqrt\(1\s*\+|calculatedRoofArea)/.test(form),
  'the UI must not compute roof area or slope-adjusted quantities')

// ---------------------------------------------------------------------------
// 5. Additive onPlanesChange bridge on the existing ManualDrawingTool.
// ---------------------------------------------------------------------------
assert.ok(tracer.includes('onPlanesChange?: (planes: Array<Array<{ x: number; y: number }>>) => void'),
  'onPlanesChange must be an optional, backwards-compatible prop')
assert.ok(tracer.includes('x: point[1], y: point[0]'),
  'TracePoint is [y,x] in ImageOverlay bounds; emit image-pixel {x,y}')
const emitCount = tracer.split('onPlanesChange?.(').length - 1
assert.ok(emitCount >= 4, `parent must never hold stale polygons (found ${emitCount} emissions)`)
for (const fragment of [
  'function finishPlane()',
  'function removePlane(index: number)',
  'function undoCorner()',
  'function clearAll()',
  'lastImageKey',
  'onAreaCalculated?: (result: ManualResult) => void',
  'onAreaCalculated?.(CLEARED)',
]) {
  assert.ok(tracer.includes(fragment), `existing tracer contract must keep ${fragment}`)
}
const existingCaller = read('../app/measure/page.tsx')
assert.ok(existingCaller.includes('onAreaCalculated={(result) => setManualArea(result.value > 0 ? result : null)}'),
  'the pre-existing /measure caller must remain untouched')
assert.ok(!existingCaller.includes('onPlanesChange'), 'the optional prop must not alter the legacy caller')

// ---------------------------------------------------------------------------
// 6. Free-only, no fake authority, no paid imagery/hosted AI/export formats.
// ---------------------------------------------------------------------------
assert.ok(!/\b(nearmap|eagleview|vantor|maxar|mapbox|arcgis|esri|bing maps|google maps)\b/i.test(combined),
  'no paid imagery provider import or string')
assert.ok(!/(api\.openai|anthropic|gemini|hosted ai)/i.test(combined), 'no hosted AI path')
assert.ok(!/\$\s?\d|\bUSD\b/i.test(combined), 'no dollar amounts in the UI')
assert.ok(!/\b(esx|skp|dwg)\b/i.test(combined), 'no ESX/SKP/DWG export')
assert.ok(!/app\/api\/photo-estimate\/report/.test(combined), 'the report route is untouched by this UI')

// ---------------------------------------------------------------------------
// 7. Exactly one new gate and one web CI step; all prior gates preserved.
// ---------------------------------------------------------------------------
const pkg = JSON.parse(read('../package.json'))
assert.equal(pkg.scripts['test:manual-trace-ui'], 'node scripts/manual-trace-ui-test.mjs')
for (const prior of [
  'test:manual-trace-doctrine', 'test:manual-trace-migration', 'test:manual-trace-recompute',
  'test:manual-trace-persistence', 'test:manual-trace-manual-route',
]) {
  assert.ok(pkg.scripts[prior], `prior gate ${prior} must be preserved`)
}
const ci = read('../.github/workflows/ci.yml')
assert.equal(ci.split('npm run test:manual-trace-ui').length - 1, 1, 'exactly one web CI step runs the new gate')
for (const prior of [
  'test:manual-trace-doctrine', 'test:manual-trace-migration', 'test:manual-trace-recompute',
  'test:manual-trace-persistence', 'test:manual-trace-manual-route',
]) {
  assert.ok(ci.includes(`npm run ${prior}`), `CI must preserve ${prior}`)
}

console.log('manual-trace-ui-test: PASS (two distinct uses, query-param-only intake, provenance-gated auto, trace→confirm→save, additive polygon bridge, free-only)')
