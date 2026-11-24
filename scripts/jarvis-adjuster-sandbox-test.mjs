import assert from 'node:assert/strict'
import {
  isAllowlisted, runSandboxAction, authorizeSandboxUrl, DEFAULT_SANDBOX_ALLOWLIST,
} from '../lib/adjuster/sandbox.ts'
import { buildClaimFacts, authorizeTool, EXIF_STRIP_REQUIRED } from '../lib/adjuster/facts.ts'

// Sandbox allowlist defaults to blocked. Nothing runs because it looks harmless.
assert.deepEqual(DEFAULT_SANDBOX_ALLOWLIST, [])
assert.equal(isAllowlisted('https://example.com', DEFAULT_SANDBOX_ALLOWLIST), false)
assert.equal(isAllowlisted('https://example.com', ['example.com']), true)
assert.equal(isAllowlisted('https://example.com.attacker.test', ['example.com']), false)
assert.equal(isAllowlisted('javascript:alert(1)', ['example.com']), false)
assert.equal(isAllowlisted('file:///etc/passwd', ['file://']), false)

const blocked = runSandboxAction({ kind: 'http_fetch', url: 'https://example.com' }, {})
assert.equal(blocked.ok, false)
assert.equal(blocked.errorNote.code, 'adjuster_error')
assert.match(blocked.errorNote.detail, /blocked/i)

const executed = runSandboxAction(
  { kind: 'http_fetch', url: 'https://example.com' },
  { allowlist: ['example.com'], perform: () => ({ status: 200 }) },
)
assert.equal(executed.ok, true)
assert.deepEqual(executed.result, { status: 200 })

// An allowlisted URL without an executable capability is a failure, never a
// fabricated success with a null result.
const noCapability = runSandboxAction({ kind: 'http_fetch', url: 'https://example.com' }, { allowlist: ['example.com'] })
assert.equal(noCapability.ok, false)
assert.equal(noCapability.errorNote.code, 'adjuster_error')

// A redirect to a host outside the allowlist is re-checked and rejected.
assert.equal(
  authorizeSandboxUrl('https://example.com', ['example.com'], () => 'https://evil.test/collect').allowed,
  false,
)
assert.equal(
  authorizeSandboxUrl('https://example.com', ['example.com'], () => 'https://example.com/safe').allowed,
  true,
)

// Missing carrier price is null, never $0.00. Scope gaps are explicit.
const facts = buildClaimFacts({
  measurements: [{ value: 1820, unit: 'sqft', provenance: 'reviewed roof sketch' }],
  prices: [{ amount: undefined, provenance: 'unknown' }],
  coverage: [{ description: 'Hail damage observed', provenance: 'adjuster photo review' }],
  xactimateCodes: [{ code: '', provenance: 'unknown' }],
})
assert.equal(facts.prices[0].amount, null, 'missing price must be null, never zero')
assert.ok(facts.scopeGaps.includes('price_missing'))
assert.equal(facts.xactimateCodes.length, 0, 'an empty code without provenance is never invented')
assert.equal(facts.measurements[0].value, 1820)

const fabricated = buildClaimFacts({ measurements: [{ value: 5000, provenance: 'unknown' }] })
assert.ok(fabricated.scopeGaps.includes('measurement_without_provenance'))

// Free/open-source first. Paid fallbacks require explicit owner approval.
assert.equal(authorizeTool({ name: 'pdf-lib', license: 'MIT', cost: 0 }, { ownerApproved: false }).allowed, true)
assert.equal(authorizeTool({ name: 'paid-vendor', license: 'proprietary', cost: 49 }, { ownerApproved: false }).allowed, false)
assert.equal(authorizeTool({ name: 'paid-vendor', license: 'proprietary', cost: 49 }, { ownerApproved: true }).allowed, true)
assert.equal(EXIF_STRIP_REQUIRED, true, 'embedded photo metadata must be stripped')

console.log('jarvis-adjuster sandbox and facts contract passed')
