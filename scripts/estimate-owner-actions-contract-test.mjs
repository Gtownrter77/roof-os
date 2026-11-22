import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { safeMailtoRecipient, safeSmsRecipient } from '../lib/estimates/contact-links.ts'

// Recipients are readable (not percent-encoded) but cannot inject URL params.
assert.equal(safeMailtoRecipient(' Owner@Example.com '), 'Owner@Example.com')
assert.equal(safeMailtoRecipient('a@b.com?subject=evil'), '')
assert.equal(safeMailtoRecipient('a@b.com\r\nBcc: x@y.com'), '')
assert.equal(safeSmsRecipient('(555) 123-4567'), '(555) 123-4567')
assert.equal(safeSmsRecipient('5551234567?body=evil'), '5551234567')
assert.equal(safeSmsRecipient('555\r\n123'), '555123')

const page = readFileSync('app/estimate/[id]/page.tsx', 'utf8')
const check = (pattern, label) => assert.ok(pattern.test(page), label)

// A network/JSON failure in the lock-tag POST previously skipped setSaving(false)
// and permanently disabled the owner's approval control.
const lockTag = page.slice(page.indexOf('Tag this lock if correct') - 900, page.indexOf('Tag this lock if correct'))
check(/try \{/, 'lock-tag handler must have a try block')
check(/\} catch \(/, 'lock-tag handler must catch network/parse failures')
check(/setRecordError\(/, 'lock-tag handler must surface an error to the owner')
check(/finally \{[\s\S]*setSaving\(false\)/, 'lock-tag handler must always clear the saving state')

// Recipients must pass through the sanitizer, not encodeURIComponent.
check(/href=\{`mailto:\$\{safeMailtoRecipient\(estimate\.estimate_snapshot\?\.customer\?\.email\)\}/, 'mailto recipient must use the sanitizer')
check(/href=\{`sms:\$\{safeSmsRecipient\(estimate\.estimate_snapshot\?\.customer\?\.phone\)\}/, 'sms recipient must use the sanitizer')
assert.ok(!/mailto:\$\{encodeURIComponent/.test(page), 'mailto recipient must not use encodeURIComponent')
assert.ok(!/sms:\$\{encodeURIComponent/.test(page), 'sms recipient must not use encodeURIComponent')
console.log('estimate-owner-actions-contract-test: PASS (lock-tag failure recovers; recipients sanitized, not percent-encoded)')
