#!/usr/bin/env node
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const ci = readFileSync('.github/workflows/ci.yml', 'utf8')
const lines = ci.split(/\r?\n/)
function job(name) {
  const start = lines.findIndex(line => line === '  ' + name + ':')
  assert.ok(start !== -1, 'Missing GitHub Actions job: ' + name)
  const end = lines.findIndex((line, i) => i > start && /^  [\w-]+:\s*$/.test(line))
  return lines.slice(start, end < 0 ? undefined : end).join('\n')
}
const web = job('web')
const field = job('field-security')
for (const [name, content] of [['web', web], ['field-security', field]]) {
  const commands = [...content.matchAll(/^\s+- run:\s*(.+)$/gm)].map(m => m[1].trim())
  assert.equal(commands.length, new Set(commands).size, name + ' has a duplicated run command')
  assert.ok(!/continue-on-error:\s*true/.test(content), name + ' must not hide failures')
}
for (const name of ['web', 'field-security']) {
  assert.ok(job(name).includes('node scripts/audit-field-deps.mjs'), name + ' must enforce field dependency audit')
}
assert.ok(web.includes('node scripts/test-field-deepmerge-mitigation.cjs'), 'Required web job must test the mitigation')
assert.ok(field.includes('node scripts/test-field-deepmerge-mitigation.cjs'), 'Independent field-security job must test the mitigation')
assert.ok(web.includes('node --experimental-strip-types scripts/worker-heartbeat-runtime-test.mjs'), 'Run heartbeat behavior tests, not marker-only tests')
assert.ok(web.includes('node scripts/release-foreman-check.mjs'), 'Required CI job must run foreman contract')
assert.ok(job('mobile').includes('npx tsc --noEmit'), 'Mobile TS gate must remain')
assert.ok(job('migration-safety').includes('Check migration order'), 'Migration gate must remain')
console.log('release-foreman-check: PASS (nonduplicated steps, security gate, worker behavior gate)')
