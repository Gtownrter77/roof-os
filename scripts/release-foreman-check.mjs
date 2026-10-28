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
  const stepLines = content.split(/\r?\n/)
  const commands = []
  for (let i = 0; i < stepLines.length; i += 1) {
    const match = stepLines[i].match(/^      - run:\s*(.+)$/)
    if (!match) continue
    const command = match[1].trim()
    let directory = '.'
    for (let j = i + 1; j < stepLines.length && !/^      - (run:|uses:|name:)/.test(stepLines[j]); j += 1) {
      const cwd = stepLines[j].match(/^        working-directory:\s*(\S+)/)
      if (cwd) directory = cwd[1]
    }
    commands.push(command + ' @ ' + directory)
  }
  assert.equal(commands.length, new Set(commands).size, name + ' has a duplicated run command in the same directory')
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
// CI must keep all four independently required branch-protection jobs.
for (const required of ['web', 'mobile', 'field-security', 'migration-safety']) {
  assert.ok(job(required).length > 0, 'Required branch-protection job must not be empty: ' + required)
}
// A merge is not a deployment or proof of live Supabase integration.
const preflight = readFileSync('scripts/live-release-preflight.mjs', 'utf8')
assert.ok(preflight.includes('No network request, provider call, secret value read, or database write was performed.'), 'Release preflight must explicitly disclose its verification limits')
console.log('release-foreman-check: PASS (nonduplicated steps, security gate, worker behavior gate)')
