import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

const requiredFiles = [
  'app/api/cron/receptionist-followups/route.ts',
  'app/api/receptionist/twilio/voice/route.ts',
  'app/api/receptionist/twilio/turn/route.ts',
  'app/api/receptionist/twilio/status/route.ts',
  'app/api/receptionist/twilio/sms/route.ts',
  'app/api/receptionist/twilio/outbound/route.ts',
  'app/api/receptionist/twilio/outbound/twiml/route.ts',
  'app/api/receptionist/stripe/payment-link/route.ts',
  'app/api/receptionist/stripe/webhook/route.ts',
  'lib/receptionist-ai.ts',
  'lib/receptionist-actions.ts',
  'lib/receptionist-twilio.ts',
  'lib/realtime-voice.ts',
  'lib/supabase/admin.ts',
  'supabase/migrations/029_receptionist_core.sql',
  'supabase/migrations/030_receptionist_atomic_booking.sql',
  'AI-RECEPTIONIST-RUNBOOK.md',
  'REALTIME-VOICE-GATEWAY.md',
]
for (const file of requiredFiles) assert.ok(existsSync(file), file)
const source = requiredFiles.map((file) => readFileSync(file, 'utf8')).join('\n')
const cronRoute = readFileSync('app/api/cron/receptionist-followups/route.ts', 'utf8')
assert.ok(cronRoute.includes("return NextResponse.json({ processed: attempts?.length || 0, started, optedOut, failed, failures }, { status: 502 })"), 'receptionist cron must surface provider failures with a non-2xx response')
for (const forbidden of ['payments.invalid', 'mockCreatePaymentLink', 'mockInboundCall']) {
  assert.equal(source.includes(forbidden), false, `forbidden mock marker: ${forbidden}`)
}
for (const marker of ['stripe.webhooks.constructEvent', 'validateRequest', 'receptionist_consents', 'receptionist_events', 'idempotencyKey', 'OPENAI_API_KEY', 'book_receptionist_appointment', 'allowBargeIn']) assert.ok(source.includes(marker), marker)
console.log('receptionist-check: PASS')
