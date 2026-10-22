import assert from 'node:assert/strict'
import { buildOnePhotoPacket, chooseAddressFilter } from '../lib/ai/one-photo.ts'

const packet = buildOnePhotoPacket({
  address: '3770 Hopkins Rd, Powder Springs, GA',
  latitude: 33.86,
  longitude: -84.68,
  stormDate: '2026-06-01T18:00:00Z',
  stormEvent: 'Severe Thunderstorm Warning',
  aerialNote: 'Open catalog only',
  code: 'GA code reference for 30127',
  codeNotes: ['Confirm locally'],
  squares: null,
})

assert.equal(packet.requiresApproval, true)
assert.equal(packet.estimate.status, 'draft-for-tech')
assert.equal(packet.delivery.slaMinutes, 10)
assert.match(packet.delivery.sms, /3770 Hopkins/)
assert.equal(packet.storm.source, 'NOAA/NWS')
console.log('one-photo: packet gated')

assert.equal(chooseAddressFilter(400, 300, 20_000), 'bright')
assert.equal(chooseAddressFilter(3000, 2000, 400_000), 'address')
