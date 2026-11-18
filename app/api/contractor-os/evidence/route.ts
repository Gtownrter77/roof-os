import { NextRequest, NextResponse } from 'next/server'
import { isUuid, readJson } from '../../../../lib/api-security'
import { getContractorContext, objectOr, rpcFailure, text } from '../../../../lib/contractor-os/writer-api'

export async function POST(request: NextRequest) {
  const context = await getContractorContext()
  if (context.response) return context.response
  const { data: { user } } = await context.supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  const parsed = await readJson(request, 32 * 1024)
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: parsed.status })
  const body = parsed.body as Record<string, unknown>
  const recordType = text(body.recordType, 80)
  const recordId = body.recordId
  const evidenceType = text(body.evidenceType, 80)
  const originalRef = text(body.originalRef, 2000)
  if (!recordType || !isUuid(recordId) || !evidenceType || !originalRef) {
    return NextResponse.json({ error: 'recordType, recordId, evidenceType, and originalRef are required.' }, { status: 400 })
  }
  const confidence = body.confidence === null || body.confidence === undefined || body.confidence === '' ? null : Number(body.confidence)
  if (confidence !== null && (!Number.isFinite(confidence) || confidence < 0 || confidence > 1)) {
    return NextResponse.json({ error: 'confidence must be between 0 and 1.' }, { status: 400 })
  }
  const { data, error } = await context.supabase.rpc('contractor_capture_evidence', {
    p_record_type: recordType,
    p_record_id: recordId,
    p_evidence_type: evidenceType,
    p_original_ref: originalRef,
    p_derived_data: objectOr(body.derivedData),
    p_provenance: objectOr(body.provenance),
    p_confidence: confidence,
  })
  if (error || !data) return rpcFailure(error, 'Evidence could not be captured.')
  return NextResponse.json({ evidence: data }, { status: 201 })
}
