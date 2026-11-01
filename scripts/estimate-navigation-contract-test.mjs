import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

const list = readFileSync('app/estimate/page.tsx', 'utf8')
// Require both destinations, independently of the map callback variable name.
// The former duplicate detail assertion required a removed create-handler's
// `estimate.id` even though the existing `e.id` detail navigation was retained.
for (const [target, route] of [
  [/router\.push\(`\/estimate\/\$\{[^}]+\.id\}`\)/, 'app/estimate/[id]/page.tsx'],
  [/router\.push\(`\/estimate\/\$\{[^}]+\.id\}\/edit`\)/, 'app/estimate/[id]/edit/page.tsx'],
]) {
  assert.match(list, target, `The estimate list must retain navigation to ${route}`)
  assert.ok(existsSync(route), `Estimate navigation must resolve to an actual page: ${route}`)
}
assert.ok(list.includes("router.push('/estimate/new')"), 'New estimate opens the template-first creation page')
assert.ok(existsSync('app/estimate/new/page.tsx'))
console.log('estimate-navigation-contract: PASS (detail, editor, and template-first creation)')
