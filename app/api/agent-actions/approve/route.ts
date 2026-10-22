import { NextRequest, NextResponse } from 'next/server'
import { isUuid, readJson } from '../../../../lib/api-security'
import { createClient } from '../../../../lib/supabase/server'

type ApprovalBody = {
  batchId?: unknown
  actionIds?: unknown
  approvalSummaryHash?: unknown
  approvedPayloadHash?: unknown
}

function hash(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{32,128}$/i.test(value)
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })

  const parsedBody = await readJson(request)
  if ('error' in parsedBody) return NextResponse.json({ error: parsedBody.error }, { status: parsedBody.status })
  const body = parsedBody.body as ApprovalBody
  const batchId = body.batchId
  const actionIds = body.actionIds
  if (!isUuid(batchId)) return NextResponse.json({ error: 'A valid batchId is required.' }, { status: 400 })
  if (!Array.isArray(actionIds) || actionIds.length < 1 || actionIds.length > 200 || !actionIds.every(isUuid)) {
    return NextResponse.json({ error: 'actionIds must contain 1–200 valid UUIDs.' }, { status: 400 })
  }
  if (!hash(body.approvalSummaryHash) || !hash(body.approvedPayloadHash)) {
    return NextResponse.json({ error: 'Approval hashes are required.' }, { status: 400 })
  }

  const { data, error } = await supabase.rpc('approve_agent_action_batch', {
    p_batch_id: batchId,
    p_action_ids: actionIds,
    p_approval_summary_hash: body.approvalSummaryHash,
    p_approved_payload_hash: body.approvedPayloadHash,
  })
  if (error) {
    const message = error.message.toLowerCase()
    if (message.includes('authentication required')) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    if (message.includes('administrator') || message.includes('approvable')) return NextResponse.json({ error: error.message }, { status: 403 })
    if (message.includes('not found')) return NextResponse.json({ error: 'Action batch not found.' }, { status: 404 })
    return NextResponse.json({ error: 'Could not approve action batch.', detail: error.message }, { status: 502 })
  }
  return NextResponse.json({ approval: data })
}
