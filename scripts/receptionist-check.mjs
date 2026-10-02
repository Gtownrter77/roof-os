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
assert.ok(cronRoute.includes('const maxAttempts = 3'), 'receptionist cron must cap automated retries')
assert.ok(cronRoute.includes('nextAttemptNumber = attempt.attempt_number + 1'), 'receptionist cron must schedule a new attempt rather than reusing a failed row')
assert.ok(cronRoute.includes('backoffHours = attempt.attempt_number === 1 ? 1 : 4'), 'receptionist cron must use bounded backoff for retries')
for (const forbidden of ['payments.invalid', 'mockCreatePaymentLink', 'mockInboundCall']) {
  assert.equal(source.includes(forbidden), false, `forbidden mock marker: ${forbidden}`)
}
for (const marker of ['stripe.webhooks.constructEvent', 'validateRequest', 'receptionist_consents', 'receptionist_events', 'idempotencyKey', 'OPENAI_API_KEY', 'book_receptionist_appointment', 'allowBargeIn']) assert.ok(source.includes(marker), marker)
const receptionistActions = readFileSync('lib/receptionist-actions.ts', 'utf8')
assert.ok(receptionistActions.includes(".eq('workspace_id', input.workspaceId)"), 'receptionist lead lookup must be workspace-scoped')
assert.ok(receptionistActions.includes('workspace_id: input.workspaceId'), 'receptionist lead creation must persist the configured workspace')
console.log('receptionist-check: PASS')
