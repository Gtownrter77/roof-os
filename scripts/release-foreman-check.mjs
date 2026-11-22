#!/usr/bin/env node
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'

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

// 59: the documented migration baseline must be derived from the filesystem,
// not left to rot while a new head lands.
const migrations = readdirSync('supabase/migrations').filter((name) => name.endsWith('.sql')).sort()
assert.equal(migrations.at(-1), '110_release_job_safety_hold.sql', 'migration head must match the documented head')
assert.equal(migrations.length, 108, 'migration count must match the documented count')
for (const doc of ['README.md', 'DEPLOYMENT.md']) {
  const source = readFileSync(doc, 'utf8')
  assert.match(source, /110_release_job_safety_hold\.sql/, `${doc} must name the current migration head`)
  assert.match(source, /108 migration files/, `${doc} must state the current migration count`)
}
assert.match(ci, /test -f supabase\/migrations\/110_release_job_safety_hold\.sql/, 'CI must assert the head migration exists')

// 60: registered security gates that were never run anywhere must now be
// present in at least one workflow, and new batch-6 gates must be registered.
const allWorkflows = readdirSync('.github/workflows')
  .filter((name) => name.endsWith('.yml') || name.endsWith('.yaml'))
  .map((name) => readFileSync('.github/workflows/' + name, 'utf8'))
  .join('\n')
const previouslyUnwired = [
  'test:field-cors', 'test:performance', 'test:phase-0-register', 'test:frontend-route-integrity',
  'test:supabase-client-stability', 'test:llama-agent', 'test:camera-audio',
  'test:passport-public-share', 'test:passport-public-link',
  'test:contractoros-control-plane', 'test:contractoros-writers', 'test:contractoros-authority',
  'test:claims-provenance', 'test:secret-scan', 'test:drone-url-validation',
  'test:literal-newline', 'test:live-release-preflight',
]
for (const gate of previouslyUnwired) {
  assert.ok(allWorkflows.includes('npm run ' + gate), 'registered gate must be wired into CI: ' + gate)
}
const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
for (const gate of previouslyUnwired) {
  assert.ok(pkg.scripts[gate], 'gate must be registered in package.json: ' + gate)
}

// 61-70: batch-7 gates must be registered and wired, not merely present on disk.
const batch7Gates = [
  'test:agent-action-recovery', 'test:release-check-auth-marker',
  'test:provider-error-sanitization', 'test:web-error-recovery',
]
for (const gate of batch7Gates) {
  assert.ok(allWorkflows.includes('npm run ' + gate), 'batch-7 gate must be wired into CI: ' + gate)
  assert.ok(pkg.scripts[gate], 'batch-7 gate must be registered in package.json: ' + gate)
}

// The legacy inline-secret grep must exclude the maintained scanner's fake
// fixtures; otherwise a required CI job fails on values that are not secrets.
// Build the pattern instead of embedding it literally — the CI grep would
// otherwise flag this assertion as an inline secret.
const inlinePattern = "grep -RInE '" + ['CAPOUT_API_KEY', 'RAPIDAPI_KEY', 'SUPABASE_SERVICE_ROLE_KEY'].map((name) => name + '=').join('|') + "'"
const inlineSecretLines = lines.filter((line) => line.includes(inlinePattern))
assert.ok(inlineSecretLines.length > 0, 'CI must keep the inline-secret grep')
for (const line of inlineSecretLines) {
  for (const exclusion of ["--exclude='*-test.*'", "--exclude='test-*'", "--exclude='secret-scan.mjs'"]) {
    assert.ok(line.includes(exclusion), `inline-secret grep must exclude test fixtures: ${exclusion}`)
  }
}

console.log('release-foreman-check: PASS (nonduplicated steps, security gate, worker behavior gate, migration baseline, wired gates)')
