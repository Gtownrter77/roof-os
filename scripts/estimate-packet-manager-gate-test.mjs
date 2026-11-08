import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const route = readFileSync('app/api/estimates/draft/route.ts', 'utf8')
const migration = readFileSync('supabase/migrations/080_estimate_packet_manager_gate.sql', 'utf8')
assert.ok(route.includes('Manager approval is required before creating an estimate review packet.'))
assert.ok(route.includes('manager_approval_signature'))
assert.ok(migration.includes('enforce_photo_estimate_packet_manager_gate'))
assert.ok(migration.includes('manager_approved_by'))
assert.ok(migration.includes('before insert on public.estimate_review_packets'))
console.log('estimate-packet-manager-gate-test: PASS')
