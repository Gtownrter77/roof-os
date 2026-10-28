/**
 * Prebuild readiness API — deposit, crew, material, permit, and weather gate.
 *
 * Deposit, crew, and material facts are read from their own ledgers. Permit
 * and weather are owner-recorded decisions. The database stamps the check time
 * and the checker, so a browser cannot backdate either one.
 *
 * Readiness is computed here. No ready flag is stored and nothing external is
 * contacted.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../../lib/supabase/server'
import { isUuid, readJson, requireWorkspaceMember } from '../../../../../lib/api-security'
import { deriveDepositState } from '../../../../../lib/estimates/acceptance.ts'
import type { DepositEvent } from '../../../../../lib/estimates/acceptance.ts'
import { PERMIT_STATUSES, WEATHER_DECISIONS, evaluatePrebuildReadiness } from '../../../../../lib/jobs/readiness.ts'
import type { PermitStatus, WeatherDecision } from '../../../../../lib/jobs/readiness.ts'

const PERMIT_COLUMNS =
  'id,workspace_id,job_id,permit_status,permit_reference,permit_checked_at,permit_checked_by,weather_decision,weather_source,weather_checked_at,weather_checked_by,updated_at'

const DEPOSIT_COLUMNS = 'id,event_type,amount,occurred_at,method,reference,note'

type ReadinessRecordRow = {
  id: string
  workspace_id: string
  job_id: string
  permit_status: PermitStatus
  permit_reference: string
  permit_checked_at: string | null
  permit_checked_by: string | null
  weather_decision: WeatherDecision
  weather_source: string
  weather_checked_at: string | null
  weather_checked_by: string | null
  updated_at: string
}

function failureStatus(code: string | undefined): number {
  if (code === '23505') return 409
  if (code === '23514' || code === '23503' || code === '42501' || code === '22P02') return 400
  return 502
}

function boundedText(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (trimmed.length > max) return null
  return trimmed
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: 'A valid production job id is required.' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })

  const { data: workspaceId } = await supabase.rpc('current_workspace_id')
  if (!workspaceId) return NextResponse.json({ error: 'No workspace is configured.' }, { status: 400 })

  const membership = await requireWorkspaceMember(supabase, user.id, workspaceId)
  if ('response' in membership) return membership.response

  const { data: job, error: jobError } = await supabase
    .from('production_jobs')
    .select('id,job_number,customer_name,property_address,status,accepted_total,accepted_at,scope_item_count,acceptance_id')
    .eq('id', id)
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (jobError) return NextResponse.json({ error: 'Could not load the production job.' }, { status: 502 })
  if (!job) return NextResponse.json({ error: 'Production job not found.' }, { status: 404 })

  const [assignmentResult, materialResult, recordResult] = await Promise.all([
    supabase
      .from('production_job_assignments')
      .select('id,role,status')
      .eq('job_id', id)
      .eq('workspace_id', workspaceId),
    supabase
      .from('production_job_materials')
      .select('id,status')
      .eq('job_id', id)
      .eq('workspace_id', workspaceId),
    supabase
      .from('production_job_readiness')
      .select(PERMIT_COLUMNS)
      .eq('job_id', id)
      .eq('workspace_id', workspaceId)
      .maybeSingle(),
  ])

  if (assignmentResult.error || materialResult.error || recordResult.error) {
    return NextResponse.json({ error: 'Could not load the readiness evidence.' }, { status: 502 })
  }

  let events: DepositEvent[] = []
  if (job.acceptance_id) {
    const { data, error } = await supabase
      .from('estimate_deposit_events')
      .select(DEPOSIT_COLUMNS)
      .eq('acceptance_id', job.acceptance_id)
      .eq('workspace_id', workspaceId)
      .order('occurred_at', { ascending: true })
      .order('id', { ascending: true })
    if (error) return NextResponse.json({ error: 'Could not load the deposit ledger.' }, { status: 502 })
    events = (data ?? []) as DepositEvent[]
  }

  const deposit = deriveDepositState(job.accepted_total, events)
  const { data: isAdmin } = await supabase.rpc('is_workspace_admin', { target_workspace: workspaceId })

  return NextResponse.json({
    job,
    deposit,
    assignments: assignmentResult.data ?? [],
    materials: materialResult.data ?? [],
    record: recordResult.data ?? null,
    readiness: evaluatePrebuildReadiness({
      job,
      deposit,
      assignments: assignmentResult.data ?? [],
      materials: materialResult.data ?? [],
      record: recordResult.data ?? null,
    }),
    can_edit: isAdmin === true,
    note: 'Readiness is computed from recorded evidence. Nothing here contacts a permit office, weather provider, or customer.',
  })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: 'A valid production job id is required.' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })

  const { data: workspaceId } = await supabase.rpc('current_workspace_id')
  if (!workspaceId) return NextResponse.json({ error: 'No workspace is configured.' }, { status: 400 })

  const membership = await requireWorkspaceMember(supabase, user.id, workspaceId)
  if ('response' in membership) return membership.response

  const { data: isAdmin } = await supabase.rpc('is_workspace_admin', { target_workspace: workspaceId })
  if (isAdmin !== true) {
    return NextResponse.json({ error: 'Workspace owner or administrator access is required to record readiness.' }, { status: 403 })
  }

  const parsed = await readJson(request, 8 * 1024)
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: parsed.status })
  const body = parsed.body

  const { data: job, error: jobError } = await supabase
    .from('production_jobs')
    .select('id,status')
    .eq('id', id)
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (jobError) return NextResponse.json({ error: 'Could not load the production job.' }, { status: 502 })
  if (!job) return NextResponse.json({ error: 'Production job not found.' }, { status: 404 })
  if (job.status === 'completed' || job.status === 'cancelled') {
    return NextResponse.json({ error: 'A completed or cancelled job cannot record readiness.' }, { status: 409 })
  }

  const { data: existing, error: loadError } = await supabase
    .from('production_job_readiness')
    .select(PERMIT_COLUMNS)
    .eq('job_id', id)
    .eq('workspace_id', workspaceId)
    .maybeSingle()
  if (loadError) return NextResponse.json({ error: 'Could not load the readiness record.' }, { status: 502 })

  const patch: Record<string, unknown> = {}

  if (body.action === 'set_permit') {
    if (typeof body.permit_status !== 'string' || !PERMIT_STATUSES.includes(body.permit_status as PermitStatus)) {
      return NextResponse.json({ error: `permit_status must be one of ${PERMIT_STATUSES.join(', ')}.` }, { status: 400 })
    }
    const permitStatus = body.permit_status as PermitStatus
    const reference = boundedText(body.permit_reference ?? '', 120)
    if (reference === null) return NextResponse.json({ error: 'permit_reference must be at most 120 characters.' }, { status: 400 })
    if (permitStatus !== 'unknown' && permitStatus !== 'not_required' && reference.length === 0) {
      return NextResponse.json({ error: 'A permit reference is required for needed, applied, or issued.' }, { status: 400 })
    }
    patch.permit_status = permitStatus
    patch.permit_reference = permitStatus === 'unknown' ? '' : reference
  } else if (body.action === 'set_weather') {
    if (typeof body.weather_decision !== 'string' || !WEATHER_DECISIONS.includes(body.weather_decision as WeatherDecision)) {
      return NextResponse.json({ error: `weather_decision must be one of ${WEATHER_DECISIONS.join(', ')}.` }, { status: 400 })
    }
    const decision = body.weather_decision as WeatherDecision
    const source = boundedText(body.weather_source ?? '', 200)
    if (source === null) return NextResponse.json({ error: 'weather_source must be at most 200 characters.' }, { status: 400 })
    if (decision !== 'unknown' && source.length === 0) {
      return NextResponse.json({ error: 'weather_source is required when the weather is checked.' }, { status: 400 })
    }
    patch.weather_decision = decision
    patch.weather_source = decision === 'unknown' ? '' : source
  } else {
    return NextResponse.json({ error: 'Unknown action.' }, { status: 400 })
  }

  let saved: ReadinessRecordRow | null = null
  if (existing) {
    const { data, error } = await supabase
      .from('production_job_readiness')
      .update(patch)
      .eq('id', existing.id)
      .eq('job_id', id)
      .eq('workspace_id', workspaceId)
      .select(PERMIT_COLUMNS)
      .single()
    if (error) {
      return NextResponse.json({ error: error.message || 'Could not update readiness.' }, { status: failureStatus(error.code) })
    }
    saved = data
  } else {
    const { data, error } = await supabase
      .from('production_job_readiness')
      .insert({
        workspace_id: workspaceId,
        job_id: id,
        permit_status: 'unknown',
        permit_reference: '',
        weather_decision: 'unknown',
        weather_source: '',
        updated_by: user.id,
        ...patch,
      })
      .select(PERMIT_COLUMNS)
      .single()
    if (error) {
      return NextResponse.json({ error: error.message || 'Could not record readiness.' }, { status: failureStatus(error.code) })
    }
    saved = data
  }

  return NextResponse.json({
    record: saved,
    note: 'The database stamped who checked and when. Readiness was recomputed on the next read.',
  })
}
