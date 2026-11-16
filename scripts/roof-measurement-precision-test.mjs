import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { analyzeTracedPolygon, aggregateTracePlanes } from '../lib/measurements/trace-geometry.ts'
import { calculateCalibratedRoofDraft } from '../lib/measurements/calibrated-roof-draft.ts'

const rectangle = [[0,0],[0,100],[50,100],[50,0]]
const area = analyzeTracedPolygon(rectangle, 'pixels')
assert.equal(area.valid, true)
assert.equal(area.area, 5000)
assert.equal(area.perimeter, 300)
assert.equal(area.perimeterUnit, 'px')
assert.equal(area.unit, 'px2')
assert.equal(analyzeTracedPolygon([...rectangle].reverse(), 'pixels').area, 5000)
const triangle = [[0,0],[0,100],[100,0]]
assert.equal(analyzeTracedPolygon(triangle,'pixels').area, 5000)
const bowTie = [[0,0],[100,100],[0,100],[100,0]]
assert.equal(analyzeTracedPolygon(bowTie,'pixels').valid,false)
assert.match(analyzeTracedPolygon(bowTie,'pixels').warning,/crosses itself/i)
const touching = [[0,0],[0,20],[10,20],[10,0],[0,0]]
assert.equal(analyzeTracedPolygon(touching,'pixels').valid,false)
assert.equal(analyzeTracedPolygon([[0,0],[0,0],[10,0]],'pixels').valid,false)
assert.equal(analyzeTracedPolygon([[0,0],[10,0]],'pixels').valid,false)
assert.equal(analyzeTracedPolygon([[0,0],[10,10],[Number.NaN,0]],'pixels').valid,false)
assert.equal(analyzeTracedPolygon([[0,0],[0,100],[100,100]],'unsupported').valid,false)

// RED: independent planes must not silently double-count areas or shared edges.
const multi = aggregateTracePlanes([rectangle, triangle],'pixels')
assert.equal(multi.valid,false)
assert.match(multi.warning,/overlap/i)
const adjacent = [[0,100],[0,200],[50,200],[50,100]]
const joined = aggregateTracePlanes([rectangle, adjacent], 'pixels')
assert.equal(joined.valid,true)
assert.equal(joined.area,10000)
assert.equal(joined.planeCount,2)
assert.equal(joined.perimeter,500, 'shared 50-pixel edge must be counted once as internal, not perimeter')
const partialNeighbor = [[10,100],[10,150],[40,150],[40,100]]
const partial = aggregateTracePlanes([rectangle, partialNeighbor], 'pixels')
assert.equal(partial.valid,true)
assert.equal(partial.area,6500)
assert.equal(partial.perimeter,400, 'partial shared edge of 30 pixels removed from both plane outlines')
const contained = [[10,10],[10,30],[20,30],[20,10]]
assert.equal(aggregateTracePlanes([rectangle, contained], 'pixels').valid,false)
assert.equal(aggregateTracePlanes([rectangle, [...rectangle]], 'pixels').valid,false)
const cornerOnly = [[50,100],[50,150],[100,150],[100,100]]
assert.equal(aggregateTracePlanes([rectangle, cornerOnly], 'pixels').valid,true)
assert.equal(aggregateTracePlanes([rectangle, cornerOnly], 'pixels').perimeter,500)
assert.equal(aggregateTracePlanes([rectangle,bowTie],'pixels').valid,false)
assert.equal(aggregateTracePlanes([],'pixels').valid,false)
assert.equal(aggregateTracePlanes(Array.from({length:51},()=>rectangle),'pixels').valid,false)

const lat0 = 33.9, lon0 = -84.6
const geographic = [[lat0,lon0],[lat0,lon0+0.0001],[lat0+0.0001,lon0+0.0001],[lat0+0.0001,lon0]]
const geo = analyzeTracedPolygon(geographic,'geographic')
assert.equal(geo.valid,true)
assert.ok(geo.area > 850 && geo.area < 1450)
assert.ok(geo.perimeter > 65 && geo.perimeter < 160)
assert.equal(geo.unit,'sqft')
assert.equal(geo.perimeterUnit,'ft')
assert.equal(analyzeTracedPolygon([[90,0],[90,1],[89,1]],'geographic').valid,false)
assert.equal(analyzeTracedPolygon([[33,0],[33,0.03],[33.03,0.03],[33.03,0]],'geographic').valid,false)

const validPlane = [{x:0,y:0},{x:100,y:0},{x:100,y:50},{x:0,y:50}]
const base = { planes:[{vertices:validPlane,review_status:'accepted'}],scaleReferencePixels:100,
  scaleReferenceFeet:10,pitchRisePer12:6,orthographicTopDownConfirmed:true,
  uniformPitchConfirmed:true,geometryConfirmed:true }
assert.equal(calculateCalibratedRoofDraft(base).planAreaSqFt,50)
for (const gate of ['orthographicTopDownConfirmed','geometryConfirmed']) {
  assert.throws(() => calculateCalibratedRoofDraft({...base,[gate]:false}), /confirm|review|calibrat/i)
}
const converted = (pts) => pts.map(([y,x]) => ({x,y}))
assert.throws(() => calculateCalibratedRoofDraft({...base,planes:[{vertices:converted(rectangle),review_status:'accepted'},{vertices:converted(triangle),review_status:'accepted'}]}),/overlap/i)
const twoPlanes = {...base,planes:[{vertices:converted(rectangle),review_status:'accepted'},{vertices:converted(adjacent),review_status:'accepted'}]}
assert.equal(calculateCalibratedRoofDraft(twoPlanes).planAreaSqFt,100)
assert.throws(() => calculateCalibratedRoofDraft({...twoPlanes,uniformPitchConfirmed:false}), /pitch|confirm/i)
const mixed = {...twoPlanes,uniformPitchConfirmed:false,planes:[
  {vertices:converted(rectangle),review_status:'accepted',pitchRisePer12:0},
  {vertices:converted(adjacent),review_status:'accepted',pitchRisePer12:12}
]}
assert.ok(Math.abs(calculateCalibratedRoofDraft(mixed).roofAreaSqFt - (50 + 50*Math.SQRT2)) < 0.02)
assert.throws(() => calculateCalibratedRoofDraft({...base,planes:[{vertices:validPlane,review_status:'pending'}]}),/accept|review/i)
assert.throws(()=>calculateCalibratedRoofDraft({...base,planes:[{vertices:bowTie.map(([y,x])=>({x,y})),review_status:'accepted'}]}),/overlaps itself|repeats adjacent/i)
assert.throws(()=>calculateCalibratedRoofDraft({...base,planes:[{vertices:touching.map(([y,x])=>({x,y})),review_status:'accepted'}]}),/overlaps itself|repeats adjacent/i)

const read = (file) => readFileSync(new URL('../'+file, import.meta.url),'utf8')
const manual=read('components/ManualDrawingTool.tsx')
const measure=read('app/measure/page.tsx')
assert.match(manual,/aggregateTracePlanes/)
assert.match(manual,/analyzeTracedPolygon/)
assert.match(manual,/Finish plane/)
assert.match(manual,/Undo finished plane/)
assert.match(manual,/Undo corner/)
assert.match(manual,/Maximum 50 roof planes/)
assert.match(manual,/scale changes automatically recalculate plan area/)
assert.match(manual,/overlap/i)
assert.match(manual,/Not a material order/)
assert.match(measure,/Manual vs. automatic measurement check/)
assert.match(measure,/Difference: \{comparison\.toFixed\(1\)\}%/)
assert.match(measure,/previewRoofAreaFromFootprint\(planSqFt, pitchValue\)/)
assert.match(measure,/Discrepancy requires manual review/)
assert.doesNotMatch(manual,/fetch\(|\.insert\(|\.upsert\(/)
// Reviewed pitch must remain distinct from model-suggested text, persist by plane,
 // survive cached reloads, and be recalculated on the server on save.
const aerialRoute = read('app/api/measurements/aerial/route.ts')
const saveRoute = read('app/api/measurements/manual/route.ts')
const pitchMigration = read('supabase/migrations/102_reviewed_plane_pitch.sql')
assert.match(pitchMigration, /reviewed_pitch_rise_per_12 numeric/i)
assert.match(pitchMigration, /orthographic_top_down_confirmed boolean/i)
assert.match(pitchMigration, /uniform_pitch_confirmed boolean/i)
assert.match(aerialRoute, /reviewed_pitch_rise_per_12/)
// Every PATCH kind is supported: pitch column exists only on roof_planes, not roof_edges/roof_objects.
assert.match(aerialRoute, /table === 'roof_planes' \? 'id,review_status,reviewed_by,reviewed_at,reviewed_pitch_rise_per_12'/)

assert.match(aerialRoute, /pitchRisePer12/)
assert.match(aerialRoute, /orthographicTopDownConfirmed/)
assert.match(aerialRoute, /uniformPitchConfirmed/)
assert.match(aerialRoute, /calibration_status !== 'calibrated'/)
assert.match(saveRoute, /calculateCalibratedRoofDraft/)
assert.match(saveRoute, /reviewed_pitch_rise_per_12/)
assert.match(saveRoute, /aerialMeasurement\.status !== 'confirmed'/)
assert.match(measure, /reviewed_pitch_rise_per_12/)
assert.match(measure, /Save measured pitch/)
assert.match(measure, /planePitchDrafts/)
assert.match(measure, /pitchRisePer12: plane\.reviewed_pitch_rise_per_12/)
assert.doesNotMatch(measure, /Pitch description \(for notes only\)/)

console.log('precision measurement test PASS: map/image area, perimeters, 50-plane limit, invalid outlines and provisional comparison')
