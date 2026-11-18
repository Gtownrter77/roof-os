import { NextRequest, NextResponse } from 'next/server'
import { isUuid, readJson } from '../../../../../../lib/api-security'
import { getContractorContext, rpcFailure, text } from '../../../../../../lib/contractor-os/writer-api'

const STATUSES = new Set(['accepted', 'rejected', 'superseded'])

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: 'A valid evidence id is required.' }, { status: 400 })
  const context = await getContractorContext()
  if (context.response) return context.response
  const { data: { user } } = await context.supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  const parsed = await readJson(request, 8 * 1024)
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: parsed.status })
  const status = text((parsed.body as Record<string, unknown>).status, 20)
  if (!STATUSES.has(status)) return NextResponse.json({ error: 'status must be accepted, rejected, or superseded.' }, { status: 400 })
  const { data, error } = await context.supabase.rpc('contractor_review_evidence', {
    p_evidence_id: id,
    p_review_status: status,
  })
  if (error || !data) return rpcFailure(error, 'Evidence review could not be saved.')
  return NextResponse.json({ evidence: data })
}
