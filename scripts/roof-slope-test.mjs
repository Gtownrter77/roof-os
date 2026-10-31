import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

const source = readFileSync(new URL('../lib/roof-slope.ts', import.meta.url), 'utf8')
const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
const module = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)

assert.deepEqual(module.calculateRoofSlope(6, 12), { rise: 6, run: 12, pitch: 6, angleDegrees: 26.6, label: 'Standard slope' })
assert.deepEqual(module.calculateRoofSlope(9, 12), { rise: 9, run: 12, pitch: 9, angleDegrees: 36.9, label: 'Steep slope' })
assert.equal(module.calculateRoofSlope(-1, 12), null)
assert.equal(module.calculateRoofSlope(6, 0), null)
assert.equal(module.calculateRoofSlope(Number.NaN, 12), null)

const slopeCard = readFileSync(new URL('../components/RoofSlopeCard.tsx', import.meta.url), 'utf8')
const sketch = readFileSync(new URL('../app/sketch/page.tsx', import.meta.url), 'utf8')
const measure = readFileSync(new URL('../app/measure/page.tsx', import.meta.url), 'utf8')
assert.ok(slopeCard.includes('Roof slope / pitch'))
assert.ok(slopeCard.includes('ROOF/OS calculates'))
assert.ok(sketch.includes('Load aerial photo'))
assert.ok(sketch.includes('Roof edge'))
assert.ok(sketch.includes('RoofSlopeCard'))
assert.ok(sketch.includes('Download marked-up PNG'))
assert.ok(measure.includes('RoofSlopeCard'))
console.log('roof-slope-test: PASS')
