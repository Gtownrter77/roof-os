import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const trailer = readFileSync('components/EntranceTrailer.tsx', 'utf8')
const layout = readFileSync('app/layout.tsx', 'utf8')
const home = readFileSync('app/page.tsx', 'utf8')
const css = readFileSync('app/globals.css', 'utf8')

assert.ok(readFileSync('components/NextPage.tsx', 'utf8').includes('Open the radar'), 'each main screen offers a next page')
assert.ok(readFileSync('components/AppShell.tsx', 'utf8').includes('NextPage'), 'the shell carries the next page')
assert.ok(readFileSync('app/radar/page.tsx', 'utf8').includes('Walk the roof'), 'radar hands off to the roof')
assert.ok(trailer.includes('ROOF/OS'), 'the wordmark stays in the entrance')
assert.ok(trailer.includes('Skip'), 'the entrance can be skipped')
assert.ok(trailer.includes('roofos.trailer.seen.v1'), 'first open is once per device')
assert.ok(trailer.includes("get('trailer') === '1'"), 'a booth can force the entrance')
assert.ok(!/\$\d/.test(trailer), 'the entrance does not quote a price')
assert.ok(layout.includes('EntranceTrailer'), 'the entrance mounts on first open')
assert.ok(home.includes('roofos-play-trailer'), 'the booth can replay the entrance')
assert.ok(css.includes('trailer-root'), 'the entrance has its own frame')
console.log('entrance-trailer-test: PASS')
