import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// Source contract only. It protects the planned brand selectors, not rendered pixels;
// React Native appearance remains UNVERIFIED without a device or renderer.
const app = readFileSync('apps/field/App.tsx', 'utf8')
const config = JSON.parse(readFileSync('apps/field/app.json', 'utf8'))
const fieldPkg = JSON.parse(readFileSync('apps/field/package.json', 'utf8'))
const styleStart = app.indexOf('const styles = StyleSheet.create({')
const styleSheet = app.slice(styleStart)
const render = app.slice(0, styleStart)

function expect(pattern, message, source = app) {
  assert.ok(pattern.test(source), message)
}
function styleBlock(name) {
  const start = styleSheet.indexOf(`  ${name}: {`)
  assert.notEqual(start, -1, `missing style ${name}`)
  const end = styleSheet.indexOf('\n  },', start)
  assert.notEqual(end, -1, `style ${name} must be a block`)
  return styleSheet.slice(start, end)
}

expect(/function BrandMark\(/, 'a roof-mark component must exist')
assert.equal((app.match(/<BrandMark\b/g) ?? []).length, 2, 'brand mark must appear in header and auth screen')
assert.equal(
  [...render.matchAll(/styles\.brandLockup\}>[\s\S]{0,120}?<BrandMark\b/g)].length,
  2,
  'both brand marks must sit inside brand lockups',
)

expect(/brand: '#f32c33'/, 'brand red token must exist')
expect(/brandBar: '#f20e22'/, 'brand bar token must exist')
expect(/panel: '#0a1428'/, 'glass panel token must exist')
expect(/line: 'rgba\(103, 136, 184, \.36\)'/, 'glass border token must exist')
expect(/amber: '#ffb21a'/, 'amber status token must exist')

for (const name of ['primary', 'cameraButton']) {
  const block = styleBlock(name)
  expect(/colors\.brand/, `${name} must use the brand red`, block)
  expect(/shadowColor/, `${name} must carry the web CTA glow`, block)
}
expect(/color: colors\.ink/, 'primary CTA text must be white-ish, not the dark surface alias', styleBlock('primaryText'))

for (const name of ['hero', 'card', 'authCard', 'metric', 'input', 'inputHalf', 'passwordContainer', 'authTabRow']) {
  const block = styleBlock(name)
  expect(/colors\.panel/, `${name} must use the glass surface`, block)
  expect(/colors\.line/, `${name} must use the glass border`, block)
  expect(/shadowColor/, `${name} must have depth`, block)
}
for (const name of ['sectionTitle', 'cardTitle']) {
  const block = styleBlock(name)
  expect(/borderLeftWidth: 3/, `${name} must have a brand rail`, block)
  expect(/borderLeftColor: colors\.brand/, `${name} rail must use brand red`, block)
}

expect(/  statusChip: \{/, 'status chip style must exist', styleSheet)
expect(/styles\.statusChip[\s\S]{0,220}syncing \? 'Syncing'/, 'sync status must render inside the chip', render)
expect(/if \(online === null\) return styles\.statusBlue/, 'checking-connection tone must not read as synced')
expect(/borderColor: colors\.red/, 'SOS chip must use the alert border', styleBlock('sos'))
expect(/color:/, 'SOS label must have an alert text color', styleBlock('sosText'))
expect(/styles\.sosText}>SOS · Call 911/, 'SOS copy must use the alert text style', render)

expect(/<StatusBar style="light"/, 'status bar must be legible on the dark surface', render)
assert.equal(config.expo.userInterfaceStyle, 'dark', 'native chrome must match the dark app')
assert.equal(fieldPkg.dependencies?.['expo-linear-gradient'], undefined, 'skin must not add a dependency')

console.log('mobile-visual-contract-test: PASS')
