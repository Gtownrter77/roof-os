import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { spawnSync } from 'node:child_process'

const files = [
  'package.json', '.github/workflows/ci.yml',
  'scripts/production-job-gate-test.mjs', 'scripts/release-gate-summary.mjs',
  'scripts/ci/verify-production-job-postgres.sh',
  'docs/evidence/day-30-go-no-go.md', 'docs/evidence/release-gates.json',
]
function runFixture(change) {
  const root = mkdtempSync(join(tmpdir(), 'roofos-gate-'))
  try {
    for (const file of files) {
      const target = join(root, file)
      mkdirSync(dirname(target), { recursive: true })
      writeFileSync(target, readFileSync(file))
    }
    change(root)
    return spawnSync(process.execPath, ['scripts/production-job-gate-test.mjs'], {
      cwd: root, encoding: 'utf8',
    })
  } finally { rmSync(root, { recursive: true, force: true }) }
}

test('gate refuses a missing package registration', () => {
  const result = runFixture(root => {
    const path = join(root, 'package.json')
    const pkg = JSON.parse(readFileSync(path, 'utf8'))
    delete pkg.scripts['test:production-job-gate']
    writeFileSync(path, JSON.stringify(pkg))
  })
  assert.equal(result.status, 1)
  assert.match(result.stderr, /must register test:production-job-gate/)
})

for (const replacement of ['', '      # - run: npm run test:production-job-gate\n']) {
  test(`gate refuses ${replacement ? 'commented' : 'missing'} CI invocation`, () => {
    const result = runFixture(root => {
      const path = join(root, '.github/workflows/ci.yml')
      writeFileSync(path, readFileSync(path, 'utf8').replace(
        '      - run: npm run test:production-job-gate\n', replacement))
    })
    assert.equal(result.status, 1)
    assert.match(result.stderr, /web must execute npm run test:production-job-gate/)
  })
}

test('passing wiring does not turn UNKNOWN release evidence into GO', () => {
  const result = runFixture(root => {
    writeFileSync(join(root, 'docs/evidence/release-gates.json'), '{}')
  })
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /source wiring contract only/)
  assert.match(result.stdout, /Release decision: NO-GO/)
  assert.match(result.stdout, /stagingRls \| UNKNOWN/)
})
