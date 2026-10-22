import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const source = readFileSync('scripts/release-gate-summary.mjs', 'utf8')
assert.ok(!/fetch\s*\(|https?:\/\//.test(source))
assert.ok(source.includes("'UNKNOWN'"))
assert.ok(source.includes('repositoryChecks'))
assert.ok(source.includes('providerExecution'))
const report = execFileSync('node', ['scripts/release-gate-summary.mjs'], { encoding: 'utf8' })
assert.ok(report.includes('| stagingRls | UNKNOWN |'))
assert.ok(report.includes('UNKNOWN means evidence was not supplied'))
console.log('release-gate-summary-test: PASS')
