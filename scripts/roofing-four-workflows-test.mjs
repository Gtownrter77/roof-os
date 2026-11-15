import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { previewRoofAreaFromFootprint } from '../lib/measurements/footprint-preview.ts'

const level = previewRoofAreaFromFootprint(1200, 0)
assert.equal(level?.horizontalSqFt, 1200)
assert.equal(level?.illustrativeSlopedSqFt, 1200)
assert.equal(level?.verified, false)
const fiveTwelve = previewRoofAreaFromFootprint(1200, 5)
assert.ok(fiveTwelve)
assert.ok(Math.abs(fiveTwelve.illustrativeSlopedSqFt - 1300) < 0.0001)
assert.equal(fiveTwelve.slopeMultiplier, 13 / 12)
for (const [area, pitch] of [
  [0, 5], [-10, 5], [Number.NaN, 5], [Number.POSITIVE_INFINITY, 5],
  [20_000_001, 5], [1200, -1], [1200, 37], [1200, Number.NaN],
  [1200, Number.POSITIVE_INFINITY],
]) assert.equal(previewRoofAreaFromFootprint(area, pitch), null)
assert.equal('order' in fiveTwelve, false)
assert.equal('approved' in fiveTwelve, false)

const file = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const property = file('app/api/measurements/property/route.ts')
const measure = file('app/measure/page.tsx')
const manual = file('components/ManualDrawingTool.tsx')
const sketch = file('app/sketch/page.tsx')
const supplement = file('app/supplement/page.tsx')
const supplementApi = file('app/api/supplements/route.ts')

assert.match(property, /fetchWithTimeout\(OVERPASS/)
assert.match(property, /let footprintWarning: string \| null = null/)
assert.match(property, /footprintWarning, interpretation:/)
assert.doesNotMatch(property, /if \(!overpassResponse\.ok\) return NextResponse\.json/)
assert.match(property, /requireWorkspaceMember\(supabase, user\.id, workspaceId\)/)
assert.match(property, /aerial = \{ status: 'unavailable'/)

assert.match(measure, /previewRoofAreaFromFootprint/)
assert.match(measure, /setManualMode\(validGeocode\)/)
assert.match(measure, /name="building-candidate"/)
assert.match(measure, /selectedBuildingIndex === index/)
assert.match(measure, /Automatic map measurement candidate — not estimate-ready/)
assert.match(measure, /Do not order material from this projection/)
assert.match(measure, /key=\{preview \|\| \(mapCenter/)
assert.match(measure, /analyzeRoofImageWithLocalOllama/)

assert.match(manual, /Undo corner/)
assert.match(manual, /NOT aerial imagery/)
assert.match(manual, /openstreetmap\.org/)
assert.match(manual, /zoom: aerialTileUrl \? 20 : 19/)
assert.match(manual, /maxZoom=\{22\} maxNativeZoom=\{19\}/)
assert.match(manual, /horizontal footprint only/)
assert.match(manual, /Not a material order|not a material order/)
assert.doesNotMatch(manual, /order \$\{imageOrder\.squaresLabel\}/)

assert.match(sketch, /'polygon'/)
assert.match(sketch, /finishPolygon/)
assert.match(sketch, /polygonRef\.current\.push\(start\)/)
assert.match(sketch, /Finish plane/)
assert.match(sketch, /historyRef\.current\.length > 12/)
assert.match(sketch, /Field notes \(owner-entered, unverified\)/)
assert.match(sketch, /output\.toDataURL\('image\/png'\)/)

assert.match(supplement, /Supplement Wizard/)
assert.match(supplement, /Owner-entered pricing/)
assert.match(supplement, /owner_entered_field_review/)
assert.match(supplement, /priceSource: 'owner_entered_unverified'/)
assert.match(supplement, /examples\.some\(\(example\) => example\.prompt === description\.trim\(\)\)/)
assert.match(supplement, /window\.confirm/)
assert.match(supplement, /Save needs-review draft/)
assert.doesNotMatch(supplement, /additionalCost: (?:2500|1800|3200)/)
assert.match(supplementApi, /\.eq\('workspace_id', workspaceId\)/)
assert.match(supplementApi, /is_workspace_admin/)
console.log('Roofing workflows: address lookup, map preview, manual sketch and supplement contracts PASS')
