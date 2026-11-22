import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

// 81: a duplicate `scripts` key means npm/npx keeps only the LAST definition,
// silently dropping the real gate. No security gate may be defined twice, and
// the live-release-preflight command must invoke BOTH its test and its scanner.
{
  const pkgText = readFileSync('package.json', 'utf8')
  const keyCounts = new Map()
  for (const match of pkgText.matchAll(/"((?:test|verify|release|check)[^"]*)"\s*:/g)) {
    keyCounts.set(match[1], (keyCounts.get(match[1]) ?? 0) + 1)
  }
  const duplicates = [...keyCounts.entries()].filter(([, count]) => count > 1).map(([name]) => name)
  assert.deepEqual(duplicates, [], 'no gate script key may be defined twice: ' + duplicates.join(', '))

  const pkg = JSON.parse(pkgText)
  const preflight = pkg.scripts['test:live-release-preflight']
  assert.ok(preflight.includes('live-release-preflight-test.mjs'), 'preflight gate must run its unit test')
  assert.ok(preflight.includes('node scripts/live-release-preflight.mjs'), 'preflight gate must run the real static scanner')
}

// 82: the release-foreman meta-gate must derive the expected gate set from
// package.json instead of a hand-maintained array that rots after each batch.
{
  const source = readFileSync('scripts/release-foreman-check.mjs', 'utf8')
  assert.ok(!/const\s+previouslyUnwired\s*=/.test(source), 'foreman must not hardcode previouslyUnwired')
  assert.ok(!/const\s+batch7Gates\s*=/.test(source), 'foreman must not hardcode batch7Gates')
  assert.ok(!/const\s+batch8Gates\s*=/.test(source), 'foreman must not hardcode batch8Gates')
  assert.ok(source.includes("Object.keys(pkg.scripts)"), 'foreman must enumerate registered scripts')
  assert.ok(source.includes(".startsWith('test:')"), 'foreman must derive the registered test:* gate set')
  assert.ok(/waiv/.test(source), 'foreman must declare an explicit waiver set for directly-invoked gates')
}

// 82 (reviewer follow-up): behavioral fixtures proving the foreman really
// rejects the three bypasses that a source-token check cannot detect — a gate
// whose name only matches a longer sibling, a gate reusing another gate's
// script file, and a gate deleted from every manifest at once.
function foremanFixture({ pkgEdits = () => {}, workflowEdits = (text) => text } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'roof-foreman-fixture-'))
  mkdirSync(join(dir, '.github'))
  cpSync('.github/workflows', join(dir, '.github/workflows'), { recursive: true })
  // The foreman only reads these paths; symlinks keep the fixture cheap.
  for (const target of ['scripts', 'supabase', 'README.md', 'DEPLOYMENT.md']) {
    symlinkSync(resolve(target), join(dir, target))
  }
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
  pkgEdits(pkg.scripts)
  writeFileSync(join(dir, 'package.json'), JSON.stringify(pkg))
  for (const file of readdirSync(join(dir, '.github/workflows'))) {
    const path = join(dir, '.github/workflows', file)
    writeFileSync(path, workflowEdits(readFileSync(path, 'utf8')))
  }
  return dir
}
function foremanIsGreen(dir) {
  try {
    execFileSync('node', ['scripts/release-foreman-check.mjs'], { cwd: dir, stdio: 'pipe' })
    return true
  } catch {
    return false
  }
}
{
  const prefix = foremanFixture({
    pkgEdits: (scripts) => { scripts['test:production-job-probe'] = 'node scripts/unique-probe.mjs' },
    workflowEdits: (text) => text + '\n      - run: npm run test:production-job-probe-compat\n',
  })
  assert.equal(foremanIsGreen(prefix), false, 'a gate whose name is only a prefix of a wired gate must FAIL')

  const reuse = foremanFixture({
    pkgEdits: (scripts) => { scripts['test:unwired-reuse-probe'] = 'node scripts/release-check.mjs' },
  })
  assert.equal(foremanIsGreen(reuse), false, 'a gate reusing another gate’s script file must FAIL')

  const removed = foremanFixture({
    pkgEdits: (scripts) => { delete scripts['test:supplement-workflow-safety'] },
    workflowEdits: (text) => text.replace(/^.*npm run test:supplement-workflow-safety.*\r?\n/gm, ''),
  })
  assert.equal(foremanIsGreen(removed), false, 'deleting an established gate from all manifests must FAIL')

  assert.equal(foremanIsGreen(foremanFixture()), true, 'the unmodified repository must still PASS')
}

// 88: the release decision must consider EVERY evidence key present, so an
// unexpected FAIL key cannot be ignored and yield a false GO.
{
  const source = readFileSync('scripts/release-gate-summary.mjs', 'utf8')
  assert.ok(!/const\s+gateNames\s*=\s*\[\s*['"]/.test(source), 'release summary must not hardcode its gate name list')
  assert.ok(source.includes('Object.keys(evidence)'), 'release summary must include all evidence keys in the decision')

  const canonical = [
    'repositoryChecks', 'stagingMigration', 'authenticatedReadOnly', 'stagingRls',
    'stagingHeartbeat', 'physicalDevice', 'backupRestore', 'schemaParity',
    'workerRuntime', 'providerExecution',
  ]
  const dir = mkdtempSync(join(tmpdir(), 'roof-release-evidence-'))
  const evidencePath = join(dir, 'release-gates.json')
  const evidence = Object.fromEntries(canonical.map((name) => [name, 'PASS']))
  evidence.rogueUnexpectedGate = 'FAIL'
  writeFileSync(evidencePath, JSON.stringify(evidence))
  const report = execFileSync('node', ['scripts/release-gate-summary.mjs', evidencePath], { encoding: 'utf8' })
  assert.match(report, /\| rogueUnexpectedGate \| FAIL \|/, 'unknown evidence key must appear in the report')
  assert.match(report, /\*\*Release decision: NO-GO\*\*/, 'an extra FAIL key must force NO-GO, never GO')
}

console.log('gate-registry-integrity-test: PASS (no duplicate gate keys, derived foreman set, evidence-complete release decision)')
