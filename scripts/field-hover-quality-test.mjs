import assert from 'node:assert/strict'

const { scorePixels } = await import(new URL('../lib/hover/field-quality.ts', import.meta.url).href)

function solid(size, value) {
  return new Uint8ClampedArray(size * size).fill(value)
}

function checkerboard(size) {
  const pixels = new Uint8ClampedArray(size * size)
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) pixels[y * size + x] = (x + y) % 2 === 0 ? 0 : 255
  }
  return pixels
}

const SIZE = 64
const grey = scorePixels(solid(SIZE, 128), SIZE, SIZE)
assert.equal(grey.blurScore, 1, 'zero Laplacian variance must map to maximum sharpness')
assert.ok(Math.abs(grey.lightScore - 128 / 255) < 1e-6, 'light score must be normalized mean luminance')

const checker = scorePixels(checkerboard(SIZE), SIZE, SIZE)
assert.ok(checker.blurScore < grey.blurScore, 'a checkerboard must score less sharp than a flat field')
assert.ok(checker.blurScore >= 0 && checker.blurScore <= 1, 'blur score must stay in [0,1]')
assert.ok(Math.abs(checker.lightScore - 0.5) < 0.02, 'checkerboard light score must be near mid-grey')

assert.equal(scorePixels(solid(SIZE, 0), SIZE, SIZE).lightScore, 0, 'black must score zero light')
assert.equal(scorePixels(solid(SIZE, 255), SIZE, SIZE).lightScore, 1, 'white must score full light')

const empty = scorePixels(new Uint8ClampedArray(0), 0, 0)
assert.deepEqual(empty, { blurScore: 0, lightScore: 0 }, 'empty input must stay unscored')

const nonFinite = scorePixels(solid(SIZE, 128), Number.NaN, SIZE)
assert.deepEqual(nonFinite, { blurScore: 0, lightScore: 0 }, 'non-finite dimensions must stay unscored')

const mismatched = scorePixels(new Uint8ClampedArray(3), SIZE, SIZE)
assert.deepEqual(mismatched, { blurScore: 0, lightScore: 0 }, 'a truncated sample must stay unscored')

console.log('PASS hover on-device quality scoring helper')
