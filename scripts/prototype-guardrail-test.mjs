import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const notice = readFileSync('components/PrototypeNotice.tsx', 'utf8')
const layout = readFileSync('app/layout.tsx', 'utf8')

for (const marker of ['/quantum', '/genetic', '/vr', '/ar', '/pitch-gauge', '/voice-ai', '/ai-wizard', '/photo-verify']) {
  assert.ok(notice.includes(marker), `prototype route missing disclosure: ${marker}`)
}
for (const marker of ['PILOT / PROTOTYPE', 'simulated or non-authoritative results', 'customer quotes', 'insurance claims']) {
  assert.ok(notice.includes(marker), `disclosure missing: ${marker}`)
}
assert.ok(layout.includes("import PrototypeNotice from '../components/PrototypeNotice'"))
assert.ok(layout.includes('<PrototypeNotice />'))
console.log('prototype-guardrail-test: PASS')
