import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { actionableWarranties, alreadyTaskedWarrantyIds, warrantyWindow } from '../lib/warranty/expiry-window.ts'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')
const DAYS = 60

// Starvation: the old query applied LIMIT 200 before skipping already-tasked
// warranties. If the first 200 rows by expiry all had tasks, no alert was ever
// created for row 201+. Page filtering must happen before the target is filled.
const page = Array.from({ length: 200 }, (_, index) => ({ id: `w-${index + 1}` }))
const existing = alreadyTaskedWarrantyIds(
  page.map((row) => ({ automation_key: `warranty-expiry:${row.id}:${DAYS}` })),
  DAYS,
)
assert.equal(existing.size, 200, 'automation keys must resolve to their warranty ids')
const filtered = actionableWarranties([...page, { id: 'w-201' }], existing, DAYS, 200)
assert.deepEqual(filtered, [{ id: 'w-201' }], 'the untasked 201st warranty must be selected')
assert.equal(actionableWarranties(page, alreadyTaskedWarrantyIds(page.map((r) => ({ automation_key: `warranty-expiry:${r.id}:${DAYS}` })), DAYS), DAYS, 200).length, 0)

// Boundary: date-only strings truncate the window to UTC midnight and shift
// same-day expirations. The whole comparison must use full ISO timestamps.
const window = warrantyWindow(new Date('2026-11-22T23:30:00.000Z'), DAYS)
assert.equal(window.nowIso, '2026-11-22T23:30:00.000Z')
assert.equal(window.windowEndIso, '2027-01-21T23:30:00.000Z', 'the window must end at the exact time, not at UTC midnight')
assert.equal(window.today, '2026-11-22')
assert.equal(window.alertWindowDays, DAYS)
assert.equal(warrantyWindow(new Date('bad'), DAYS), null, 'an invalid clock must fail closed')

// Route wiring: paginate before filtering, use the shared window, and compare
// timestamps rather than slices.
const route = read('../app/api/cron/warranty-expiry/route.ts')
assert.match(route, /warrantyWindow\(now, ALERT_WINDOW_DAYS\)/, 'route must use the shared window helper')
assert.match(route, /alreadyTaskedWarrantyIds\(/, 'route must resolve existing tasks before paging forward')
assert.match(route, /actionableWarranties\(/, 'route must filter a page before adding to the target set')
assert.match(route, /\.range\(pageFrom, pageFrom \+ PAGE_SIZE - 1\)/, 'route must read bounded pages instead of one LIMIT 200')
assert.ok(!/\.limit\(200\)/.test(route), 'the pre-filter LIMIT 200 starvation bug must be gone')
assert.match(route, /\.lt\('expires_at', window\.nowIso\)/, 'expired rows must be compared to a full timestamp')
assert.match(route, /\.gte\('expires_at', window\.nowIso\)/, 'window start must use a full timestamp')
assert.match(route, /\.lte\('expires_at', window\.windowEndIso\)/, 'window end must use a full timestamp')

console.log('warranty-expiry-contract-test: PASS (paged filtering before target; full-timestamp window; unbounded alert starvation removed)')
