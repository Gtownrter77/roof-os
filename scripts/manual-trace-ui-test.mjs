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

// ---------------------------------------------------------------------------
// 8. Auto handoff: /measure must consume the certified photo context and reuse
//    the EXISTING local-Ollama -> aerial -> review path. No new row is created.
// ---------------------------------------------------------------------------
const MEASURE = '../app/measure/page.tsx'
const measure = read(MEASURE)
for (const fragment of [
  "'use client'",
  'useSearchParams',
  '<Suspense',
  'fallback=',
  'function MeasurePageInner(',
  '<MeasurePageInner />',
  "search.get('photoId')",
  "search.get('inspection')",
]) {
  assert.ok(measure.includes(fragment), `measure handoff wrapper must contain ${fragment}`)
}

// (a) useSearchParams must be read INSIDE the component Suspense wraps.
const innerStart = measure.indexOf('function MeasurePageInner(')
const wrapperStart = measure.indexOf('export default function MeasurePage()')
assert.ok(innerStart >= 0 && wrapperStart > innerStart, 'measure must declare inner page before the default export')
const innerSource = measure.slice(innerStart, wrapperStart)
const wrapperSource = measure.slice(wrapperStart)
assert.ok(innerSource.includes('useSearchParams()'), 'the Suspense-wrapped inner page must call useSearchParams')
assert.ok(!wrapperSource.includes('useSearchParams'), 'the default export must not call useSearchParams outside Suspense')
assert.ok(wrapperSource.indexOf('<Suspense') < wrapperSource.indexOf('<MeasurePageInner />')
  && wrapperSource.indexOf('</Suspense>') > wrapperSource.indexOf('<MeasurePageInner />'),
  'the default export must wrap the prop-free inner page in Suspense')
assert.ok(innerSource.includes("const initialPhotoId = search.get('photoId') || ''")
  && innerSource.includes("const initialInspectionId = search.get('inspection') || ''"),
  'the inner page must derive the handoff params itself')

const handoffStart = measure.indexOf('// BEGIN certified-photo auto handoff')
const handoffEnd = measure.indexOf('// END certified-photo auto handoff')
assert.ok(handoffStart >= 0 && handoffEnd > handoffStart, 'measure must mark the certified-photo handoff block')
const handoff = measure.slice(handoffStart, handoffEnd)
for (const fragment of [
  'initialPhotoId',
  'initialInspectionId',
  ".from('inspection_photos')",
  ".eq('id', initialPhotoId)",
  ".eq('inspection_id', initialInspectionId)",
  ".eq('workspace_id', workspaceId)",
  "createSignedUrl(photo.object_path",
  'new File(',
  'setFile(imageFile)',
  'setPreview(signedUrl)',
  'setImageSize({ width, height })',
  'setPhotoId(initialPhotoId)',
  'setInspectionId(initialInspectionId)',
  'readEmbeddedGps(',
  'setPhotoGpsChecked(true)',
  "fetch('/api/photo-provenance/verify'",
  'gpsVerified !== true',
  'autoMeasurementsAllowed !== true',
  'evidence only',
  'await applyAutoAnalysis(imageFile, width, height, initialPhotoId, initialInspectionId)',
]) {
  assert.ok(handoff.includes(fragment), `certified photo handoff must contain ${fragment}`)
}
assert.ok(!/\.insert\(/.test(handoff), 'handoff must reuse the certified photo, not create a new inspection/photo row')

// (b) StrictMode setup -> cleanup -> setup must not strand working=true.
assert.ok(handoff.includes("if (autoHandoffRef.current === key) autoHandoffRef.current = ''"),
  'handoff cleanup must clear the dedupe ref for its own key')
assert.ok(handoff.includes('if (active) setWorking(false)'),
  'a stale inactive setup must not clear working; setup 2 owns it')

// (c) A no-GPS/no-authorization photo is evidence only and starts NO measurement path.
assert.ok(!/Manual tracing remains available/i.test(handoff),
  'the banned stale Manual-tracing promise must not appear in the handoff block')

const helperStart = measure.indexOf('async function applyAutoAnalysis(')
const helperEnd = measure.indexOf('async function review(', helperStart)
assert.ok(helperStart >= 0 && helperEnd > helperStart, 'the existing auto tail must be a shared helper')
const helper = measure.slice(helperStart, helperEnd)
for (const fragment of [
  "fetch('/api/measurements/aerial'",
  "method: 'POST'",
  'photoId: targetPhotoId',
  'inspectionId: targetInspectionId',
  'imageWidth: width',
  'imageHeight: height',
  '`inspection-photo:${targetPhotoId}`',
  'setMeasurementId(payload.measurement.id)',
]) {
  assert.ok(helper.includes(fragment), `shared auto helper must contain ${fragment}`)
}
assert.equal(measure.split('analyzeRoofImageWithLocalOllama(').length - 1, 1,
  'local Ollama analysis must exist once and be shared by upload and handoff')

// ---------------------------------------------------------------------------
// 9. Context change resets every manual-attest input; no stale trace survives.
// ---------------------------------------------------------------------------
assert.ok(!form.includes("key={imageUrl || 'no-certified-photo'}"),
  'the manual tracer must not be remounted on photo change; its reset effect must fire')
const loadStart = form.indexOf('async function loadContext()')
const loadHead = form.slice(loadStart, form.indexOf('const { data: workspaceId', loadStart))
for (const fragment of [
  'setPlanes([])',
  'setPreviewAreaSqft(null)',
  'setScalePixels(\'\')',
  'setScaleFeet(\'\')',
  'setPlanePitches([])',
  'setUniformPitchConfirmed(false)',
  "setPitchRisePer12('')",
  'setTopDownConfirmed(false)',
  "setSavedMeasurementId('')",
  'setMessage(\'\')',
  'setError(\'\')',
]) {
  assert.ok(loadHead.includes(fragment), `context change must synchronously reset ${fragment}`)
}

// ---------------------------------------------------------------------------
// 10. Functional plane updates cannot be dropped by batched rapid edits.
// ---------------------------------------------------------------------------
assert.ok(tracer.includes('setPlanes((current) =>'), 'plane edits must use the functional setPlanes form')
assert.ok(tracer.includes('const next = [...current, [...points]]'), 'finishPlane must append to current planes')
assert.ok(tracer.includes('current.filter((_, i) => i !== index)'), 'removePlane must filter current planes')
assert.ok(tracer.includes('useEffect(() => {\n    onPlanesChange?.(planes.map(')
  && tracer.includes('}, [planes, onPlanesChange])'),
  'parent emission must come from a committed effect, never from a state updater')
assert.ok(!/\bonPlanesChange\?\.\(next\)/.test(tracer), 'no side effect may remain inside a setPlanes updater')

console.log('manual-trace-ui-test: PASS (two distinct uses, query-param-only intake, provenance-gated auto, certified-photo auto handoff reuses existing path, trace→confirm→save, stale-trace reset, additive polygon bridge, free-only)')
