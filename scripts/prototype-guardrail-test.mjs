import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const notice = readFileSync('components/PrototypeNotice.tsx', 'utf8')
const layout = readFileSync('app/layout.tsx', 'utf8')
const canvass = readFileSync('app/canvass/page.tsx', 'utf8')
const portal = readFileSync('app/portal/page.tsx', 'utf8')
const notifications = readFileSync('app/notifications/page.tsx', 'utf8')
const canvassMentor = readFileSync('lib/ai/canvass-mentor.ts', 'utf8')
for (const marker of ['/quantum','/genetic','/vr','/ar','/pitch-gauge','/voice-ai','/ai-wizard','/photo-verify','/portal','/schedule','/drone','/invoices','/sign','/integrations','/admin','/pricing','/exterior','/deck','/siding','/repair','/doors-windows','/manual','/logistics','/homedepot','/insurance','/insurance-intel','/chat','/notifications','/status','/ai','/ai-train','/codes','/predict','/ready','/export']) assert.ok(notice.includes(marker), `prototype route missing disclosure: ${marker}`)
for (const marker of ['PILOT / PROTOTYPE','simulated or non-authoritative results','customer quotes','insurance claims']) assert.ok(notice.includes(marker), `disclosure missing: ${marker}`)
assert.ok(layout.includes("import PrototypeNotice from '../components/PrototypeNotice'"))
assert.ok(layout.includes('<PrototypeNotice />'))
assert.ok(canvass.includes('useState<CanvassPin[]>([])'), 'canvassing must start without fabricated pins')
for (const marker of ['Evergreen Terrace', 'Homer Simpson', 'Alex Rivera', 'GA-RCN-2026-88', 'August 2026']) {
  assert.ok(!canvass.includes(marker), `canvass must not contain fabricated customer or credential data: ${marker}`)
}
assert.ok(canvass.includes('session only'), 'canvass must disclose that unconverted pins are not persisted')
assert.ok(portal.includes('Customer records are not connected yet'))
for (const marker of ['John Doe', 'Jane Smith', 'Bob Johnson', 'john@example.com', '(555)']) {
  assert.ok(!portal.includes(marker), `customer portal must not contain fake customer data: ${marker}`)
}
for (const marker of ['John Doe', '123 Main St', '456 Oak Ave', '789 Pine Rd', 'Sarah Wilson']) {
  assert.ok(!notifications.includes(marker), `notifications must not contain fake alerts: ${marker}`)
}
assert.ok(notifications.includes('Live notifications are not implemented'))
assert.ok(canvassMentor.includes('Check with your insurer before deciding whether to file.'))
assert.ok(!canvassMentor.includes('individual policyholders are not singled out'))
console.log('prototype-guardrail-test: PASS')
