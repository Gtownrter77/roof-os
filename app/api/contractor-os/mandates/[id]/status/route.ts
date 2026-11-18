import { NextRequest, NextResponse } from 'next/server'
import { isUuid, readJson } from '../../../../../../lib/api-security'
import { getContractorContext, rpcFailure, text } from '../../../../../../lib/contractor-os/writer-api'

const STATUSES = new Set(['active', 'paused', 'expired', 'cancelled', 'completed', 'revoked'])

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: 'A valid mandate id is required.' }, { status: 400 })
  const context = await getContractorContext()
  if (context.response) return context.response
  const { data: { user } } = await context.supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  const parsed = await readJson(request, 8 * 1024)
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: parsed.status })
  const body = parsed.body as Record<string, unknown>
  const status = text(body.status, 20)
  if (!STATUSES.has(status)) return NextResponse.json({ error: 'status is not a valid mandate transition.' }, { status: 400 })
  const { data, error } = await context.supabase.rpc('contractor_transition_mandate', {
    p_mandate_id: id,
    p_status: status,
    p_cancellation_reason: typeof body.cancellationReason === 'string' ? text(body.cancellationReason, 1000) : null,
  })
  if (error || !data) return rpcFailure(error, 'Mandate could not be transitioned.')
  return NextResponse.json({ mandate: data })
}
