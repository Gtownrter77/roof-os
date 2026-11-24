import { NextRequest, NextResponse } from 'next/server'
import { isUuid, readJson, requireWorkspaceMember } from '../../../../lib/api-security'
import { createClient } from '../../../../lib/supabase/server'
import { claimReadScope } from '../../../../lib/jarvis/api/index'
import { enqueueJob } from '../../../../lib/jarvis/api/server'

const NO_STORE = { 'Cache-Control': 'private, no-store, max-age=0' }

async function context() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { response: NextResponse.json({ error: 'Authentication required.' }, { status: 401 }) }
  const { data: workspaceId } = await supabase.rpc('current_workspace_id')
  if (!isUuid(workspaceId)) {
    return { response: NextResponse.json({ error: 'Workspace could not be verified.' }, { status: 403 }) }
  }
  const membership = await requireWorkspaceMember(supabase, user.id, workspaceId)
  if (membership.response) return { response: membership.response }
  return { supabase, workspaceId }
}

export async function GET() {
  const ctx = await context()
  if ('response' in ctx) return ctx.response
  const { data, error } = await ctx.supabase
    .from('adjuster_claims')
    .select('id,lead_id,status,disabled,identity_id,time_zone,created_at,updated_at')
    .match(claimReadScope(ctx.workspaceId))
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) return NextResponse.json({ error: 'Adjuster claims could not be loaded.' }, { status: 502, headers: NO_STORE })
  return NextResponse.json({ claims: data ?? [] }, { headers: NO_STORE })
}

export async function POST(request: NextRequest) {
  const ctx = await context()
  if ('response' in ctx) return ctx.response
  const parsed = await readJson(request, 8 * 1024)
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: parsed.status })
  const body = parsed.body as Record<string, unknown>
  const leadId = body.leadId
  if (!isUuid(leadId)) return NextResponse.json({ error: 'A valid lead id is required.' }, { status: 400 })

  // Verify the lead exists in this workspace before any claim write.
  const { data: lead, error: leadError } = await ctx.supabase
    .from('leads')
    .select('id')
    .eq('id', leadId)
    .eq('workspace_id', ctx.workspaceId)
    .maybeSingle()
  if (leadError) return NextResponse.json({ error: 'Lead scope could not be verified.' }, { status: 503 })
  if (!lead) return NextResponse.json({ error: 'Lead not found in this workspace.' }, { status: 404 })

  const identityId = typeof body.identityId === 'string' ? body.identityId : ''
  const { data: claim, error: claimError } = await ctx.supabase
    .from('adjuster_claims')
    .upsert({ workspace_id: ctx.workspaceId, lead_id: leadId, identity_id: identityId }, { onConflict: 'workspace_id,lead_id' })
    .select('id,lead_id,status,disabled')
    .single()
  if (claimError || !claim) {
    return NextResponse.json({ error: 'Claim could not be enrolled.' }, { status: 502 })
  }

  try {
    await enqueueJob(ctx.supabase as never, {
      workspaceId: ctx.workspaceId,
      type: 'run_claim_plan',
      payload: { claimId: claim.id, leadId },
      claimId: claim.id,
      leadId,
    })
  } catch {
    // The enrolled claim is durable; return it with a retry signal rather than
    // pretending the plan job exists or deleting the claim.
    return NextResponse.json({ claim, jobQueued: false, retry: true }, { status: 202, headers: NO_STORE })
  }
  return NextResponse.json({ claim, jobQueued: true }, { status: 201, headers: NO_STORE })
}
