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
assert.ok(web.includes('npm run test:field-deps-audit-contract'), 'Required web job must test the field dependency audit contract')
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
assert.equal(migrations.at(-1), '114_jarvis_adjuster.sql', 'migration head must match the documented head')
assert.equal(migrations.length, 112, 'migration count must match the documented count')
for (const doc of ['README.md', 'DEPLOYMENT.md']) {
  const source = readFileSync(doc, 'utf8')
  assert.match(source, /114_jarvis_adjuster\.sql/, `${doc} must name the current migration head`)
  assert.match(source, /112 migration files/, `${doc} must state the current migration count`)
}
assert.match(ci, /test -f supabase\/migrations\/114_jarvis_adjuster\.sql/, 'CI must assert the head migration exists')

// 60/82: derive the complete registered test:* gate set from package.json —
// no hand-maintained per-batch arrays that silently rot. The derivation is:
//   * a gate is normally wired by an EXACT `npm run <gate>` step (boundary-aware
//     name matching, so a longer sibling name cannot satisfy it);
//   * a small documented waiver set covers gates invoked by an exact direct
//     command (`node scripts/...`) or by an exact command inside a composite
//     script (`npm run release-check`). Matching the EXACT command body, never
//     merely "the same script file appears somewhere", prevents an unwired new
//     gate from riding on another gate's file reference.
const allWorkflows = readdirSync('.github/workflows')
  .filter((name) => name.endsWith('.yml') || name.endsWith('.yaml'))
  .map((name) => readFileSync('.github/workflows/' + name, 'utf8'))
  .join('\n')
const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
// Both step forms occur in this repository: `- run: cmd` and `- name: ...`
// followed by an indented `run: cmd`. Capture both, ignoring block scalars.
const workflowCommands = [...allWorkflows.matchAll(/^\s*(?:-\s*)?run:\s*(.+)$/gm)]
  .map((match) => match[1].trim())
  .filter((command) => command && !command.startsWith('|') && !command.startsWith('>'))
const splitCommands = (command) => String(command).split(/\s*&&\s*/).map((part) => part.trim()).filter(Boolean)
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Every command that CI actually executes, including commands expanded from
// composite scripts invoked by name (one level is enough for this repository).
const executedCommands = new Set()
for (const command of workflowCommands) {
  for (const part of splitCommands(command)) executedCommands.add(part)
  const npmRun = command.match(/npm run ([\w:-]+)/)
  if (npmRun && pkg.scripts[npmRun[1]]) {
    for (const part of splitCommands(pkg.scripts[npmRun[1]])) executedCommands.add(part)
  }
}
const wiredByName = (gate) => workflowCommands.some((command) => new RegExp('npm run\\s+' + escapeRegExp(gate) + '(?![\\w:-])').test(command))
const wiredByExactCommand = (gate) => executedCommands.has(pkg.scripts[gate])

// The aggregator is a documented recursion waiver (finding 79) — it runs the
// whole registry rather than being a standalone gate invoked by a workflow.
const gateWaivers = new Set(['test:all'])
// Gates wired by an exact direct/composite command rather than `npm run <name>`.
const directInvocationWaivers = new Set([
  'test:mobile-apk-provenance', 'test:security-definer-triggers', 'test:mobile-local-db-migrations',
  'test:passport-rate-limit-privacy', 'test:security-definer-search-path', 'test:passport-rate-limit-rls',
  'test:parallel-anonymous', 'test:release-foreman', 'test:worker-heartbeat-runtime',
])
for (const gate of [...gateWaivers, ...directInvocationWaivers]) {
  assert.ok(pkg.scripts[gate], 'waived gate must still be registered: ' + gate)
}
// Established-gate floor (findings 1–80): the derivation above covers the CURRENT
// registry but cannot notice a gate deleted from every manifest at once. Keep
// the previously-required set as a floor, always registered and wired.
const establishedGates = [
  'test:field-cors', 'test:performance', 'test:phase-0-register', 'test:frontend-route-integrity',
  'test:supabase-client-stability', 'test:llama-agent', 'test:camera-audio',
  'test:passport-public-share', 'test:passport-public-link', 'test:contractoros-control-plane',
  'test:contractoros-writers', 'test:contractoros-authority', 'test:claims-provenance',
  'test:secret-scan', 'test:drone-url-validation', 'test:literal-newline', 'test:live-release-preflight',
  'test:agent-action-recovery', 'test:release-check-auth-marker', 'test:provider-error-sanitization',
  'test:web-error-recovery', 'test:agent-runtime-recovery', 'test:action-batch-binding',
  'test:supplement-workflow-safety', 'test:test-all-coverage',
  'test:field-deps-audit-contract',
]
const registeredTestGates = Object.keys(pkg.scripts).filter((name) => name.startsWith('test:'))
for (const gate of establishedGates) {
  assert.ok(pkg.scripts[gate], 'established gate must remain registered: ' + gate)
}
for (const gate of registeredTestGates) {
  assert.ok(typeof pkg.scripts[gate] === 'string' && pkg.scripts[gate].trim(), 'gate must have a command: ' + gate)
  if (gateWaivers.has(gate)) continue
  const wired = wiredByName(gate) || (directInvocationWaivers.has(gate) && wiredByExactCommand(gate))
  assert.ok(wired, 'registered gate must be wired into CI (exact name or documented direct command): ' + gate)
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
