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
  'supabase/migrations/043_receptionist_workspace_integrity.sql',
  'AI-RECEPTIONIST-RUNBOOK.md',
  'REALTIME-VOICE-GATEWAY.md',
]
for (const file of requiredFiles) assert.ok(existsSync(file), file)
const source = requiredFiles.map((file) => readFileSync(file, 'utf8')).join('\n')
const cronRoute = readFileSync('app/api/cron/receptionist-followups/route.ts', 'utf8')
const receptionistActions = readFileSync('lib/receptionist-actions.ts', 'utf8')
const paymentRoute = readFileSync('app/api/receptionist/stripe/payment-link/route.ts', 'utf8')
const turnRoute = readFileSync('app/api/receptionist/twilio/turn/route.ts', 'utf8')
const integrityMigration = readFileSync('supabase/migrations/043_receptionist_workspace_integrity.sql', 'utf8')

assert.ok(cronRoute.includes("return NextResponse.json({ processed: attempts?.length || 0, started, optedOut, failed, failures }, { status: 502 })"), 'receptionist cron must surface provider failures with a non-2xx response')
assert.ok(cronRoute.includes('const maxAttempts = 3'), 'receptionist cron must cap automated retries')
assert.ok(cronRoute.includes('nextAttemptNumber = attempt.attempt_number + 1'), 'receptionist cron must schedule a new attempt rather than reusing a failed row')
assert.ok(cronRoute.includes('backoffHours = attempt.attempt_number === 1 ? 1 : 4'), 'receptionist cron must use bounded backoff for retries')

assert.ok(receptionistActions.includes(".eq('workspace_id', input.workspaceId)"), 'receptionist lead lookup must be workspace scoped')
assert.ok(receptionistActions.includes("workspace_id: input.workspaceId,"), 'receptionist lead creation must persist workspace ownership')
assert.ok(receptionistActions.includes("from('workspace_members')"), 'receptionist owner must be checked against workspace membership')
assert.ok(receptionistActions.includes("!ownerMembership"), 'receptionist lead creation must fail closed when the configured owner is outside the workspace')

assert.ok(paymentRoute.includes("supabase.rpc('is_workspace_admin'"), 'payment-link creation must require workspace administration')
assert.ok(paymentRoute.indexOf("supabase.rpc('is_workspace_admin'") < paymentRoute.indexOf("stripe.checkout.sessions.create"), 'payment-link authorization must precede provider creation')
assert.ok(!paymentRoute.includes("admin.from('invoices'"), 'payment-link invoice reads must use the authenticated client')
assert.ok(!paymentRoute.includes("admin.from('receptionist_payment_links'"), 'payment-link ledger reads/writes must use the authenticated client')
assert.ok(turnRoute.includes(".eq('workspace_id', workspaceId)"), 'Twilio turn session lookup must remain workspace scoped')

assert.ok(integrityMigration.includes('alter table public.leads\n  alter column workspace_id set not null'), 'lead workspace ownership must be non-null')
assert.ok(integrityMigration.includes("role in ('owner', 'admin', 'member')"), 'receptionist booking creator must be a workspace member')
assert.ok(integrityMigration.includes("where l.id = p_lead_id\n    and l.workspace_id = p_workspace_id"), 'booking RPC must require a workspace-local lead')
assert.ok(integrityMigration.includes("p_created_by is null"), 'booking RPC must reject a missing creator')
assert.ok(integrityMigration.includes("set search_path = ''"), 'security-definer booking RPC must use an empty search path')
assert.ok(integrityMigration.includes('revoke all on function public.book_receptionist_appointment'), 'booking RPC must not be callable by browser roles')
assert.ok(integrityMigration.includes('grant execute on function public.book_receptionist_appointment') && integrityMigration.includes('to service_role'), 'booking RPC must remain worker-only')

for (const forbidden of ['payments.invalid', 'mockCreatePaymentLink', 'mockInboundCall']) {
  assert.equal(source.includes(forbidden), false, `forbidden mock marker: ${forbidden}`)
}
for (const marker of ['stripe.webhooks.constructEvent', 'validateRequest', 'receptionist_consents', 'receptionist_events', 'idempotencyKey', 'OPENAI_API_KEY', 'book_receptionist_appointment', 'allowBargeIn']) assert.ok(source.includes(marker), marker)
console.log('receptionist-check: PASS')
