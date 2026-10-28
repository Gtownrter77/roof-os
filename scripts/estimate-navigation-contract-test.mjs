import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

const list = readFileSync('app/estimate/page.tsx', 'utf8')
for (const [target, route] of [
  ['/estimate/${estimate.id}', 'app/estimate/[id]/page.tsx'],
  ['/estimate/${e.id}', 'app/estimate/[id]/page.tsx'],
  ['/estimate/${e.id}/edit', 'app/estimate/[id]/edit/page.tsx'],
]) {
  assert.ok(list.includes(target), `The estimate list must retain navigation to ${target}`)
  assert.ok(existsSync(route), `Estimate navigation to ${target} must resolve to an actual page: ${route}`)
}
console.log('estimate-navigation-contract: PASS')
