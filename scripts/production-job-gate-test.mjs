import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const read = (path) => readFileSync(path, 'utf8')
const pkg = JSON.parse(read('package.json'))
const ci = read('.github/workflows/ci.yml')
// Require executable steps in web, not comments, substrings, or another job.
const web = ci.split('  web:\n')[1]?.split(/\n  [a-z][\w-]*:/)[0] || ''
const required = [
  'test:production-job', 'test:production-job-schedule',
  'test:production-job-readiness', 'test:production-job-fieldwork',
  'test:production-job-qc', 'test:production-job-invoice',
  'test:production-job-payment', 'test:production-job-warranty',
  'test:production-job-e2e', 'test:owner-break-glass',
  'test:security-definer-migrations', 'test:release-gate-summary',
  'test:production-job-gate',
]
for (const name of required) {
  assert.ok(pkg.scripts[name], `package.json must register ${name}`)
  assert.ok(web.split('\n').some(line => line.trim() === `- run: npm run ${name}`),
    `web must execute npm run ${name}`)
}
assert.ok(!/continue-on-error:|if:/.test(web), 'web gate steps must not be optional')
assert.ok(ci.includes('run: bash scripts/ci/verify-production-job-postgres.sh'))
assert.ok(ci.includes('run: bash scripts/ci/verify-restore-postgres.sh'))
assert.ok(read('scripts/ci/verify-production-job-postgres.sh').includes('production-job-lifecycle-assertions.sql'))
const decision = read('docs/evidence/day-30-go-no-go.md')
assert.match(decision, /## Rollback/)
assert.match(decision, /UNKNOWN.*not a pass/)
const report = execFileSync(process.execPath, ['scripts/release-gate-summary.mjs'], { encoding: 'utf8' })
assert.match(report, /Release decision: (?:GO|NO-GO)/)
console.log('production-job-gate: PASS (source wiring contract only; not CI completion or release authorization)')
process.stdout.write(report)
