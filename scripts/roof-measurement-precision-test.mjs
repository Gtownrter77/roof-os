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

const multi = aggregateTracePlanes([rectangle, triangle],'pixels')
assert.equal(multi.valid,true)
assert.equal(multi.area,10000)
assert.equal(multi.planeCount,2)
assert.equal(multi.perimeter,300+(100+100+Math.sqrt(20000)))
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
console.log('precision measurement test PASS: map/image area, perimeters, 50-plane limit, invalid outlines and provisional comparison')
