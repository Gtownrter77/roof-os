import { NextRequest, NextResponse } from 'next/server'
import { isUuid, readJson } from '../../../../lib/api-security'
import { arrayOr, getContractorContext, objectOr, rpcFailure, text } from '../../../../lib/contractor-os/writer-api'

function optionalDate(value: unknown) {
  if (value === null || value === undefined || value === '') return null
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) return undefined
  return new Date(value).toISOString()
}

export async function POST(request: NextRequest) {
  const context = await getContractorContext()
  if (context.response) return context.response
  const { data: { user } } = await context.supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  const parsed = await readJson(request, 32 * 1024)
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: parsed.status })
  const body = parsed.body as Record<string, unknown>
  const mandateKey = text(body.mandateKey, 120)
  const purpose = text(body.purpose, 2000)
  if (mandateKey.length < 3) return NextResponse.json({ error: 'mandateKey must be at least 3 characters.' }, { status: 400 })
  if (!purpose) return NextResponse.json({ error: 'purpose is required.' }, { status: 400 })
  const startsAt = optionalDate(body.startsAt)
  const expiresAt = optionalDate(body.expiresAt)
  if (startsAt === undefined || expiresAt === undefined) return NextResponse.json({ error: 'startsAt and expiresAt must be valid dates.' }, { status: 400 })
  if (startsAt && expiresAt && Date.parse(expiresAt) <= Date.parse(startsAt)) return NextResponse.json({ error: 'expiresAt must be after startsAt.' }, { status: 400 })
  if (body.ownerUserId !== undefined && body.ownerUserId !== null && !isUuid(body.ownerUserId)) return NextResponse.json({ error: 'ownerUserId must be a valid user UUID.' }, { status: 400 })

  const { data, error } = await context.supabase.rpc('contractor_create_mandate', {
    p_mandate_key: mandateKey,
    p_purpose: purpose,
    p_scope: objectOr(body.scope),
    p_tools: arrayOr(body.tools),
    p_action_limits: objectOr(body.actionLimits),
    p_prohibitions: arrayOr(body.prohibitions),
    p_resources: objectOr(body.resources),
    p_success_criteria: objectOr(body.successCriteria),
    p_escalation_policy: objectOr(body.escalationPolicy),
    p_owner_user_id: typeof body.ownerUserId === 'string' ? body.ownerUserId : null,
    p_starts_at: startsAt,
    p_expires_at: expiresAt,
  })
  if (error || !data) return rpcFailure(error, 'Mandate could not be created.')
  return NextResponse.json({ mandate: data }, { status: 201 })
}
