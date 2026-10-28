import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')
const readJson = (path) => JSON.parse(read(path))

const study = read('../docs/agent-5/capout-public-study.md')
const ledgerDoc = read('../docs/agent-5/rea-execution-ledger.md')
const ledger = readJson('../docs/agent-5/rea-ledger.json')

// 1. The study names its sources and its boundaries.
assert.match(study, /^# CapOut public-behavior study \(clean-room\)/m)
for (const section of [
  '## Boundaries first',
  '## Public behavior, as documented',
  '## Capability parity matrix',
  '## Differentiators A–F',
  '## What Roof OS does not claim',
  '## Unknowns to close later',
]) {
  assert.ok(study.includes(section), `study keeps the ${section} section`)
}
assert.ok(study.includes('https://docs.capout.ai/guides/structured-estimate-imports.md'))
assert.ok(study.includes('https://docs.capout.ai/guides/download-esx.md'))
assert.ok(study.includes('No CapOut account, API key, trial, dashboard, carrier PDF, pricing catalog, private endpoint, or authenticated request was used.'))

// 2. Vendor claims are labelled, never adopted.
const accuracyLine = study.split('\n').find((line) => line.includes('99.99%'))
assert.ok(accuracyLine, 'the marketed accuracy figure is recorded')
assert.match(accuracyLine, /Marketing page claims/, 'the 99.99% figure appears only as a vendor claim')
assert.ok(study.includes('**Vendor claim, unverified here:**'))
assert.ok(!/Roof OS (generates|produces|creates) ESX/i.test(study))
assert.ok(!/Roof OS achieved/i.test(study))
assert.ok(!/ESX parity is (achieved|complete|verified)/i.test(study))

// 3. Required disclaimers are present.
for (const line of [
  'No ESX generation and no ESX parity.',
  'No Xactimate catalog resolution or carrier coverage.',
  'No independent verification of CapOut\'s accuracy claim.',
  'No automatic insurer submission, claim approval, payment, or customer contact.',
]) {
  assert.ok(study.includes(line), `study keeps the disclaimer: ${line}`)
}

// 4. The ledger is structured and honest about incomplete work.
assert.equal(ledger.issue, 336)
assert.equal(ledger.day, 15)
assert.equal(ledger.environment.rea_version, '6.8.0')
assert.equal(ledger.environment.rea_skill, 'reverse-engineer-anything')
assert.ok(Array.isArray(ledger.boundaries) && ledger.boundaries.length >= 4)
assert.ok(ledger.boundaries.some((line) => line.includes('No CapOut account')))

const allowed = new Set(['completed', 'failed', 'unavailable', 'not_authorized'])
for (const execution of ledger.executions) {
  assert.ok(allowed.has(execution.status), `ledger status is explicit: ${execution.id}`)
  if (execution.status === 'completed') {
    assert.equal(execution.exit_code, 0, `completed run has exit code 0: ${execution.id}`)
    assert.ok(execution.conclusion.length > 20, `completed run states a conclusion: ${execution.id}`)
  }
  if (execution.status === 'failed') {
    assert.ok(execution.result.reason, `failed run states the reason: ${execution.id}`)
    assert.ok(execution.result.remediation, `failed run states the remediation: ${execution.id}`)
  }
  for (const artifact of execution.artifacts) {
    if (artifact.sha256) assert.match(artifact.sha256, /^[0-9a-f]{64}$/)
  }
}

const analyzerRuns = ledger.executions.filter((execution) => execution.status === 'completed'
  && execution.tool.includes('analyze-javascript-application'))
assert.ok(analyzerRuns.length >= 2, 'both completed analyzer runs are recorded')
assert.ok(analyzerRuns.every((execution) => /^ev_[0-9a-f]{64}$/.test(execution.result.evidence_id)),
  'every completed analyzer run records its evidence id')
assert.ok(analyzerRuns.some((execution) => execution.id === 'rea-docs-index-bundle'
  && execution.result.caps_hit.length === 2), 'semantic caps are disclosed')

assert.ok(ledger.unavailable.some((entry) => entry.capability === 'rea capture-browser-scenario'
  && entry.reason.includes('libnspr4.so')), 'browser capture is recorded as unavailable, not done')
assert.ok(ledger.unavailable.some((entry) => entry.capability === 'Authenticated CapOut API observation'))
assert.ok(ledgerDoc.includes('What this ledger does not prove'))
assert.ok(ledgerDoc.includes('Both semantic caps were reached'))

// 5. The study covers the implemented behavior, and the code keeps it.
const types = read('../lib/agent5/types.ts')
assert.ok(types.includes('enabled: boolean'))
assert.ok(types.includes('paid_when_incurred: boolean'))
assert.ok(types.includes('alternate_rows: number'))

const parser = read('../lib/agent5/parser.ts')
assert.ok(parser.includes('function parseFlag'))
assert.ok(parser.includes('line.enabled && line.line_total !== null'), 'totals exclude alternate rows')

const comparator = read('../lib/agent5/comparator.ts')
assert.ok(comparator.includes('input.carrier.filter((line) => line.enabled)'))
assert.ok(comparator.includes('input.contractor.filter((line) => line.enabled)'))

const reviewer = read('../lib/agent5/reviewer.ts')
assert.ok(reviewer.includes('alternate_rows: args.carrier.filter((line) => !line.enabled).length'))
assert.ok(reviewer.includes('paid_when_incurred_rows'))
assert.ok(reviewer.includes('export_blocked: true'))
assert.ok(reviewer.includes('capout_required: false'))

const behaviorTest = read('./agent5-supplement-specialist-test.mjs')
assert.ok(behaviorTest.includes('never rewritten to $0.00'))
assert.ok(behaviorTest.includes('a disabled contractor alternate never becomes missing scope'))
assert.ok(behaviorTest.includes('paid_when_incurred'))

// 6. Local-first is unchanged: no outbound client anywhere in the engine or route.
for (const path of ['../lib/agent5/parser.ts', '../lib/agent5/comparator.ts', '../lib/agent5/reviewer.ts', '../app/api/supplements/review/route.ts']) {
  const source = read(path)
  assert.ok(!/\bfetch\s*\(|axios|node:https?|from ['"]https?/i.test(source), `${path} stays offline`)
  assert.ok(!/import[^\n]*capout|require\([^)]*capout/i.test(source), `${path} does not import a CapOut client`)
}

// 7. The contract is wired into the required web job and the local script list.
const pkg = readJson('../package.json')
assert.equal(pkg.scripts['test:agent5-capout-study'], 'node scripts/agent5-capout-study-test.mjs')
const ci = read('../.github/workflows/ci.yml')
assert.ok(ci.includes('npm run test:agent5-capout-study'), 'required web job runs the study contract')

console.log('agent5-capout-study-test: PASS (sourced public study, vendor claims labelled, honest REA ledger, alternate/PWI parity flags, local-first preserved, CI wiring)')
