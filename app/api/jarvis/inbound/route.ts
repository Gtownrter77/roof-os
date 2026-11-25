import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { isUuid, readJson } from '../../../../lib/api-security'
import { getSupabaseEnv } from '../../../../lib/supabase/env'
import { isValidEmail, normalizeE164 } from '../../../../lib/jarvis/guards'
import { writeInbound } from '../../../../lib/jarvis/api/server'

const NO_STORE = { 'Cache-Control': 'private, no-store, max-age=0' }

/**
 * Inbound carrier/provider webhook. The destination workspace comes from
 * deployment configuration, never from the request body. A claim in another
 * workspace is rejected before any write.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.JARVIS_ADJUSTER_WEBHOOK_SECRET?.trim()
  const workspaceId = process.env.JARVIS_ADJUSTER_WORKSPACE_ID?.trim() ?? ''
  const identityId = process.env.JARVIS_ADJUSTER_IDENTITY_ID?.trim() ?? ''
  if (!secret || !isUuid(workspaceId)) {
    return NextResponse.json({ error: 'Inbound adjuster webhook is not configured.' }, { status: 503, headers: NO_STORE })
  }
  const authorization = request.headers.get('authorization') ?? ''
  if (authorization !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401, headers: NO_STORE })
  }

  const parsed = await readJson(request, 64 * 1024)
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: parsed.status })
  const body = parsed.body as Record<string, unknown>
  const claimId = body.claimId
  const from = typeof body.from === 'string' ? body.from : ''
  const text = typeof body.body === 'string' ? body.body : ''
  if (!isUuid(claimId) || !from || !text) {
    return NextResponse.json({ error: 'claimId, from and body are required.' }, { status: 400, headers: NO_STORE })
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!serviceKey) {
    return NextResponse.json({ error: 'Service role is not configured.' }, { status: 503, headers: NO_STORE })
  }
  const { url } = getSupabaseEnv()
  const supabase = createServiceClient(url, serviceKey, { auth: { persistSession: false } })

  // Bind the claim to the configured workspace before reading or writing anything.
  const { data: claim, error: claimError } = await supabase
    .from('adjuster_claims')
    .select('id,workspace_id,lead_id')
    .eq('id', claimId)
    .eq('workspace_id', workspaceId)
    .maybeSingle()
  if (claimError) return NextResponse.json({ error: 'Claim could not be verified.' }, { status: 502, headers: NO_STORE })
  if (!claim) return NextResponse.json({ error: 'Claim not found in the configured workspace.' }, { status: 404, headers: NO_STORE })

  const phone = normalizeE164(from)
  const email = isValidEmail(from)
  let matchedLead: { id: string; workspaceId: string; phone?: string | null; email?: string | null } | null = null
  let leadQuery = supabase.from('leads').select('id,workspace_id,phone,email').eq('workspace_id', workspaceId)
  if (phone) leadQuery = leadQuery.eq('phone', phone)
  else if (email) leadQuery = leadQuery.eq('email', email)
  if (phone || email) {
    const { data: lead } = await leadQuery.maybeSingle()
    if (lead) {
      matchedLead = {
        id: lead.id,
        workspaceId: lead.workspace_id,
        phone: lead.phone,
        email: lead.email,
      }
    }
  }

  let result: Awaited<ReturnType<typeof writeInbound>>
  try {
    result = await writeInbound(
      supabase as never,
      { webhookWorkspaceId: workspaceId, identityId },
      {
        claimId: claim.id,
        claimWorkspaceId: claim.workspace_id,
        claimLeadId: claim.lead_id,
        from,
        body: text,
        matchedLead,
      },
    )
  } catch {
    // The RPC writes the message and job in one transaction; a failure here
    // leaves no durable half-write, so an honest retry signal is safe.
    return NextResponse.json({ error: 'Inbound message could not be recorded.' }, { status: 502, headers: NO_STORE })
  }
  if (result.ok === false) return NextResponse.json({ error: `Inbound message rejected: ${result.reason}` }, { status: 403, headers: NO_STORE })
  return NextResponse.json({ received: true, jobId: result.jobId }, { headers: NO_STORE })
}
