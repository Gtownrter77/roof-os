import { NextRequest, NextResponse } from 'next/server'
import { isUuid, readJson } from '../../../../lib/api-security'
import { getContractorContext, arrayOr, objectOr, rpcFailure, text } from '../../../../lib/contractor-os/writer-api'

export async function POST(request: NextRequest) {
  const context = await getContractorContext()
  if (context.response) return context.response
  const { data: { user } } = await context.supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  const parsed = await readJson(request, 64 * 1024)
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: parsed.status })
  const body = parsed.body as Record<string, unknown>
  const recordType = text(body.recordType, 80)
  if (!recordType || !isUuid(body.recordId)) return NextResponse.json({ error: 'recordType and a valid recordId are required.' }, { status: 400 })
  if (!body.snapshot || typeof body.snapshot !== 'object' || Array.isArray(body.snapshot)) return NextResponse.json({ error: 'snapshot must be a JSON object.' }, { status: 400 })
  if (body.sourceRefs !== undefined && !Array.isArray(body.sourceRefs)) return NextResponse.json({ error: 'sourceRefs must be a JSON array.' }, { status: 400 })
  if (body.correctionOf !== undefined && body.correctionOf !== null && !isUuid(body.correctionOf)) return NextResponse.json({ error: 'correctionOf must be a valid revision id.' }, { status: 400 })
  const { data, error } = await context.supabase.rpc('contractor_create_record_revision', {
    p_record_type: recordType,
    p_record_id: body.recordId,
    p_snapshot: objectOr(body.snapshot),
    p_source_refs: arrayOr(body.sourceRefs),
    p_correction_of: body.correctionOf ?? null,
  })
  if (error || !data) return rpcFailure(error, 'Record revision could not be created.')
  return NextResponse.json({ revision: data }, { status: 201 })
}
