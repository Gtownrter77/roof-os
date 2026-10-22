import assert from 'node:assert/strict'
import {
  canvass125Count,
  draftAssignCloser,
  draftColorPins,
  draftDoorsPerHour,
  draftDuplicateCheck,
  draftEmail,
  draftHailOverlay,
  draftHardStopHostile,
  draftHardStopRefusal,
  draftLeadScoreBefore,
  draftMultiTradeFlag,
  draftNextDoor,
  draftNoSoliciting,
  draftOpenerScript,
  draftPhoneFromNotes,
  draftSkipDnk,
  draftSms,
  draftStormZoneTurf,
  draftStreetCoverage,
  draftWalkingOrder,
} from '../lib/ai/canvass125.ts'

assert.equal(canvass125Count(), 125)

const score = draftLeadScoreBefore({ hailInches: 1.25, roofAge: 18, newHomeowner: true, neighborsSold: 2 })
assert.equal(score.requiresApproval, true)
assert.ok(score.score >= 70)
assert.ok(score.reasons.includes('damaging hail'))
assert.ok(score.reason.length > 5)
assert.ok(score.next.length > 3)

assert.equal(draftHailOverlay(1).show, true)
assert.equal(draftHailOverlay(1).band, 'damaging')
assert.equal(draftHailOverlay(0.25).show, false)
assert.equal(draftStormZoneTurf(1.5).priority, 'high')
assert.equal(draftNoSoliciting(true).hardStop, true)
assert.equal(draftHardStopRefusal(true).outcome, 'DO_NOT_KNOCK')
assert.equal(draftHardStopHostile('get off my property').stop, true)
assert.equal(draftColorPins('INTERESTED').color, '#10b981')
assert.match(draftColorPins('INTERESTED').label, /Interested/)
assert.equal(draftStreetCoverage(8, 10).pct, 80)
assert.equal(draftDoorsPerHour(24, 3).rate, 8)
assert.equal(draftNextDoor('1 Main', ['1 Main', '2 Main']).next, '2 Main')
assert.equal(draftSkipDnk('9 Oak', ['9 Oak']).skip, true)
assert.equal(draftDuplicateCheck('9 Oak', ['9 Oak']).duplicate, true)
assert.equal(draftPhoneFromNotes('call 770-555-1212').phone, '770-555-1212')
assert.match(draftSms('Ryan', '3770 Hopkins').text, /3770 Hopkins/)
assert.match(draftEmail('Ryan', '3770 Hopkins').subject, /3770 Hopkins/)
assert.match(draftOpenerScript('2026-06-01').script, /2026-06-01/)
assert.equal(draftAssignCloser(80).assign, true)
assert.equal(draftAssignCloser(40).assign, false)
assert.deepEqual(draftMultiTradeFlag('need gutters and siding').trades.sort(), ['gutter', 'siding'])
assert.deepEqual(draftWalkingOrder(['2 Oak', '1 Oak', '3 Main']).order, ['3 Main', '1 Oak', '2 Oak'])

console.log('canvass125: 125 detailed drafts gated and asserted')
