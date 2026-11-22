import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

// 79: `test:all` printed PASS while running only 16 of 155 registered gates.
// Its command list must now be derived from package.json, with every omission
// accounted for by an explicit, documented waiver.
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const registered = Object.keys(pkg.scripts).filter((name) => name.startsWith('test:')).sort()

const result = spawnSync(process.execPath, ['scripts/test-all.mjs', '--list'], {
  cwd: new URL('..', import.meta.url),
  encoding: 'utf8',
})
assert.equal(result.status, 0, `test-all --list failed: ${result.stderr?.trim() ?? ''}`)
const plan = JSON.parse(result.stdout.trim())
assert.ok(Array.isArray(plan.commands) && plan.commands.length > 100, 'test:all must run the full registered gate set, not a hand-picked subset')

const covered = [...plan.commands, ...Object.keys(plan.waived)].sort()
assert.deepEqual(covered, registered, 'every registered test:* gate must be either run or explicitly waived')
assert.deepEqual(plan.commands, [...new Set(plan.commands)], 'test:all must not run the same gate twice')
for (const [gate, reason] of Object.entries(plan.waived)) {
  assert.ok(registered.includes(gate), `waiver names an unregistered gate: ${gate}`)
  assert.ok(typeof reason === 'string' && reason.length >= 20, `waiver needs a documented reason: ${gate}`)
}
assert.ok(!plan.commands.includes('test:all'), 'test:all must not recurse into itself')

const source = readFileSync(new URL('../scripts/test-all.mjs', import.meta.url), 'utf8')
assert.ok(source.includes('package.json'), 'test-all must derive its command list from package.json')
assert.ok(source.includes('--list'), 'test-all must expose its plan for verification')

console.log(`test-all-coverage-test: PASS (${plan.commands.length} gates run, ${Object.keys(plan.waived).length} documented waivers)`)
