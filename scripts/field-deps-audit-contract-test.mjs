import assert from 'node:assert/strict'
import { parseAuditReport, advisoriesFor, classifyVulnerabilities } from '../lib/field-deps-audit.mjs'

// 92: `advisories()` cached on `name` alone even though its result depends on the
// cycle-detection set. A cyclic `via` graph (Y -> X -> Y) visited with Y first
// cached an under-approximation of X; when the top-level loop later reached X it
// reused that truncated set, so an unremediated advisory vanished and a REQUIRED
// branch-protection gate printed `fixed` with no blocking entry.
{
  const GHSA_FIXED = 'GHSA-0000-fixed-0000'
  const GHSA_BAD = 'GHSA-1111-unremediated-1111'
  const vulnerabilities = {
    // Deliberately ordered Y before X: that is the order that poisons the cache.
    Y: { severity: 'high', via: ['X', { source: GHSA_BAD, title: 'unremediated' }] },
    X: { severity: 'high', via: ['Y', { source: GHSA_FIXED, title: 'remediated' }] },
  }
  const remediated = (id) => id === GHSA_FIXED
  const { blocking, fixed } = classifyVulnerabilities(vulnerabilities, remediated)
  assert.ok(blocking.some(([name, , ids]) => name === 'X' && ids.includes(GHSA_BAD)),
    'a cyclic via graph must not hide an unremediated advisory behind a cached subset')
  assert.ok(!fixed.some((entry) => entry.startsWith('X ')),
    'X must never be classified as fixed while its unremediated advisory survives')

  const cache = new Map()
  advisoriesFor(vulnerabilities, 'Y', new Set(), cache)
  assert.ok(advisoriesFor(vulnerabilities, 'X', new Set(), cache).has(GHSA_BAD),
    'the unremediated ID must survive a later top-level lookup of X')
}

// 100: a parseable-but-malformed npm audit payload must fail closed. Only empty
// stdout was rejected before; {"error":...}, {} and a truncated scan with a
// non-zero metadata total all collapsed to `{}` and produced a clean audit.
{
  assert.throws(() => parseAuditReport(''), 'empty stdout must fail')
  assert.throws(() => parseAuditReport('not json'), 'unparseable stdout must fail')
  assert.throws(() => parseAuditReport('{"error":{"code":"ENOAUDIT"}}'), 'an npm audit error payload must fail closed')
  assert.throws(() => parseAuditReport('{}'), 'a payload without vulnerabilities must fail closed')
  assert.throws(() => parseAuditReport('{"vulnerabilities":{}}'), 'a payload without metadata totals must fail closed')
  assert.throws(() => parseAuditReport('{"vulnerabilities":{},"metadata":{"vulnerabilities":{"high":2}}}'),
    'a truncated scan that reports advisories with an empty payload must fail closed')
  const valid = parseAuditReport('{"vulnerabilities":{"a":{"severity":"high"}},"metadata":{"vulnerabilities":{"high":1}}}')
  assert.deepEqual(Object.keys(valid.vulnerabilities), ['a'], 'a well-formed audit report must parse')
}

console.log('field-deps-audit-contract-test: PASS (cyclic via graph, malformed payload fail-closed)')
