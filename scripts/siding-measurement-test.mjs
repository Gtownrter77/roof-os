import assert from 'node:assert/strict'

function closeTo(actual, expected, tolerance = 1e-9) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `expected ${actual} to be within ${tolerance} of ${expected}`)
}

function calculateSection({ widthFt, stories, rows, exposureIn }) {
  assert.ok(widthFt > 0 && stories > 0 && rows > 0 && exposureIn > 0)
  const sidingHeightFt = rows * exposureIn / 12
  return { sidingHeightFt, grossSqFt: widthFt * sidingHeightFt * stories }
}

function calculate(sections, wastePercent) {
  assert.ok(sections.length > 0)
  assert.ok(wastePercent >= 0 && wastePercent <= 100)
  const results = sections.map(calculateSection)
  const grossSqFt = results.reduce((sum, item) => sum + item.grossSqFt, 0)
  return { results, grossSqFt, materialSqFt: grossSqFt * (1 + wastePercent / 100) }
}

{
  const result = calculate([{ widthFt: 40, stories: 1, rows: 100, exposureIn: 8 }], 10)
  closeTo(result.results[0].sidingHeightFt, 66.66666666666667)
  closeTo(result.grossSqFt, 2666.6666666666667)
  closeTo(result.materialSqFt, 2933.3333333333335)
}

{
  const result = calculate([{ widthFt: 40, stories: 1, rows: 96, exposureIn: 7.25 }], 0)
  closeTo(result.results[0].sidingHeightFt, 58)
  closeTo(result.grossSqFt, 2320)
}

{
  const result = calculate([
    { widthFt: 40, stories: 2, rows: 20, exposureIn: 8 },
    { widthFt: 30, stories: 1, rows: 15, exposureIn: 7.25 },
  ], 10)
  closeTo(result.results[0].grossSqFt, 1066.6666666666667)
  closeTo(result.results[1].grossSqFt, 271.875)
  closeTo(result.grossSqFt, 1338.5416666666667)
  closeTo(result.materialSqFt, 1472.3958333333335)
}

{
  assert.throws(() => calculate([{ widthFt: 0, stories: 1, rows: 10, exposureIn: 8 }], 10))
  assert.throws(() => calculate([{ widthFt: 40, stories: 1, rows: 10, exposureIn: 8 }], -1))
  assert.throws(() => calculate([{ widthFt: 40, stories: 1, rows: 10, exposureIn: 8 }], 101))
}

console.log('siding measurement tests passed')
