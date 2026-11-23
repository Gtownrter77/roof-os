import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { sessionLookupFailureStatus, shouldAppendTurn } from '../lib/receptionist/turn-status.ts'

// Confirmation-review regression: `.includes(callerLine)` treated any earlier
// identical utterance as a retry and dropped a legitimate repeat turn. Only an
// exact trailing caller+assistant pair is a retry of this turn.
assert.equal(shouldAppendTurn(null, 'Caller: yes', 'Assistant: OK'), true, 'a new session must record the turn')
assert.equal(shouldAppendTurn('Caller: yes\nAssistant: OK', 'Caller: yes', 'Assistant: OK'), false, 'a retried turn must not be appended twice')
assert.equal(shouldAppendTurn('Caller: yes\nAssistant: OK', 'Caller: yes', 'Assistant: Sure'), true, 'a repeated utterance with a new reply must be recorded')
assert.equal(shouldAppendTurn('Caller: yes\nAssistant: OK\nCaller: no\nAssistant: Got it', 'Caller: yes', 'Assistant: OK'), true, 'an earlier identical turn must not suppress a later one')

// PGRST116 is a no-row result from `.single()`, not a server failure. An
// unknown call session must stay a 404; a real lookup error must stay 503.
assert.equal(sessionLookupFailureStatus({ code: 'PGRST116' }, false), 404, 'single() no-row must remain a 404')
assert.equal(sessionLookupFailureStatus({ code: 'PGRST500' }, false), 503, 'a real lookup failure must be retryable')
assert.equal(sessionLookupFailureStatus(null, false), 404, 'a missing session must remain a 404')
assert.equal(sessionLookupFailureStatus(null, true), null, 'a loaded session must proceed')

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
const outboundRoute = readFileSync('app/api/receptionist/twilio/outbound/route.ts', 'utf8')
const smsRoute = readFileSync('app/api/receptionist/twilio/sms/route.ts', 'utf8')
const statusRoute = readFileSync('app/api/receptionist/twilio/status/route.ts', 'utf8')
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
assert.ok(outboundRoute.includes("supabase.rpc('is_workspace_admin'"), 'outbound voice must require workspace administration')
assert.ok(outboundRoute.indexOf("supabase.rpc('is_workspace_admin'") < outboundRoute.indexOf('client.calls.create'), 'outbound voice authorization must precede provider action')
assert.ok(outboundRoute.includes(".eq('id', body.leadId).eq('workspace_id', workspaceId)"), 'outbound voice leadId must be workspace scoped')
assert.ok(smsRoute.includes("supabase.rpc('is_workspace_admin'"), 'outbound SMS must require workspace administration')
assert.ok(smsRoute.indexOf("supabase.rpc('is_workspace_admin'") < smsRoute.indexOf('messages.create'), 'outbound SMS authorization must precede provider action')
assert.ok(smsRoute.includes(".eq('id', body.leadId).eq('workspace_id', workspaceId)"), 'outbound SMS leadId must be workspace scoped')

assert.ok(integrityMigration.includes('alter table public.leads\n  alter column workspace_id set not null'), 'lead workspace ownership must be non-null')
assert.ok(integrityMigration.includes("role in ('owner', 'admin', 'member')"), 'receptionist booking creator must be a workspace member')
assert.ok(/where l\.id = p_lead_id\s+and l\.workspace_id = p_workspace_id/.test(integrityMigration), 'booking RPC must require a workspace-local lead')
assert.ok(integrityMigration.includes("p_created_by is null"), 'booking RPC must reject a missing creator')
assert.ok(integrityMigration.includes("set search_path = ''"), 'security-definer booking RPC must use an empty search path')
assert.ok(integrityMigration.includes('revoke all on function public.book_receptionist_appointment'), 'booking RPC must not be callable by browser roles')
assert.ok(integrityMigration.includes('grant execute on function public.book_receptionist_appointment') && integrityMigration.includes('to service_role'), 'booking RPC must remain worker-only')

for (const forbidden of ['payments.invalid', 'mockCreatePaymentLink', 'mockInboundCall']) {
  assert.equal(source.includes(forbidden), false, `forbidden mock marker: ${forbidden}`)
}
for (const marker of ['stripe.webhooks.constructEvent', 'validateRequest', 'receptionist_consents', 'receptionist_events', 'idempotencyKey', 'askOllamaJson', 'book_receptionist_appointment', 'allowBargeIn']) assert.ok(source.includes(marker), marker)

// Batch 10 / 93: a failed opt-out lookup must block the irreversible provider
// call. A discarded query error makes a TCPA revocation look like "no opt-out".
assert.match(smsRoute, /const \{ data: optOut, error: consentError \} = await admin\.from\('receptionist_consents'\)/, 'SMS consent read must capture its error')
assert.ok(!smsRoute.includes("const { data: optOut }"), 'SMS consent read must not discard its error')
const smsConsentGuard = smsRoute.indexOf('if (consentError) return')
assert.ok(smsConsentGuard !== -1 && smsConsentGuard < smsRoute.indexOf('messages.create'), 'a consent read failure must block the SMS provider call')

// Batch 10 / 94: same fail-open for voice, plus the attempt ledger is durable.
assert.match(outboundRoute, /const \{ data: optOut, error: consentError \} = await admin\.from\('receptionist_consents'\)/, 'voice consent read must capture its error')
assert.ok(!outboundRoute.includes("const { data: optOut }"), 'voice consent read must not discard its error')
const voiceConsentGuard = outboundRoute.indexOf('if (consentError) return')
assert.ok(voiceConsentGuard !== -1 && voiceConsentGuard < outboundRoute.indexOf('client.calls.create'), 'a consent read failure must block the voice provider call')
assert.match(outboundRoute, /const \{ error: attemptError \} = await admin\.from\('receptionist_call_attempts'\)\.insert\(/, 'call attempt insert must capture its error')
assert.match(outboundRoute, /attemptError[\s\S]{0,240}warning/, 'a call attempt write failure must be surfaced to the caller')

// Batch 10 / 97: all durable turn writes must be checked, and a read error is
// a retryable 503 rather than a false "session not found" 404.
assert.match(turnRoute, /class ReceptionistWriteError extends Error/, 'turn writes need a distinct retryable failure type')
assert.match(turnRoute, /function checkedWrite\(/, 'turn writes must go through a checked helper')
assert.ok((turnRoute.match(/checkedWrite\(await supabase\./g) || []).length >= 8, 'all eight durable turn writes must be checked')
assert.match(turnRoute, /sessionLookupFailureStatus\(sessionError, Boolean\(session\)\)/, 'turn session lookup must use the tested status classifier')
assert.match(turnRoute, /if \(error instanceof ReceptionistWriteError\) return new Response\([^\n]*status: 502/, 'persistence failure must be retryable by Twilio')
assert.ok(!turnRoute.includes('error instanceof Error ? error.message'), 'turn catch must not echo raw errors to the caller')
assert.match(turnRoute, /shouldAppendTurn\(existingTranscript, callerLine, assistantLine\)/, 'turn transcript appends must use the tested trailing-pair classifier')
assert.ok(!turnRoute.includes('session.transcript?.includes(callerLine)'), 'an earlier identical utterance must not suppress a legitimate repeat turn')
// The LLM reply is not deterministic, so retry dedup cannot rely on it. The
// transcript must be the last durable write: a failed branch write returns 502
// before any transcript exists, and the retry starts from identical state.
const afterTranscriptWrite = turnRoute.slice(turnRoute.indexOf('update({ transcript, updated_at'))
assert.ok(!afterTranscriptWrite.includes('checkedWrite(await supabase.'), 'transcript must be the last durable write so a failed earlier write cannot leave a turn to duplicate')
assert.match(turnRoute, /deterministicUuid\(`twilio:\$\{callSid\}:followup-task`\)/, 'follow-up task needs a stable id across webhook retries')
assert.match(turnRoute, /from\('tasks'\)\.upsert\(/, 'follow-up task insert must be an idempotent upsert')

// Batch 10 / 98: status callbacks must not report success after failed writes.
assert.match(statusRoute, /const \{ error: sessionUpdateError \} = await supabase\.from\('receptionist_sessions'\)\.update\(/, 'session status write must capture its error')
assert.match(statusRoute, /if \(sessionUpdateError\) return new Response\([^\n]*status: 502/, 'session status write failure must be retryable')
assert.match(statusRoute, /const \{ error: eventPersistError \} = await supabase\.from\('receptionist_events'\)\.upsert\(/, 'status event upsert must capture its error')
assert.match(statusRoute, /if \(eventPersistError\) return new Response\([^\n]*status: 502/, 'status event write failure must be retryable')
assert.ok(!statusRoute.includes('error instanceof Error ? error.message'), 'status catch must not echo raw errors to the caller')
console.log('receptionist-check: PASS (auth ordering, workspace scoping, checked durable writes, consent fail-closed)')
