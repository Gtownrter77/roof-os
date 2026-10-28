/**
 * QC punch items for one production job.
 *
 * Any workspace member may record a defect and resolve one. A resolved item is
 * immutable. Open critical items block the supervisor closeout and the
 * completion of the job. Nothing here changes the handoff, the schedule, or a
 * customer record.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../../lib/supabase/server'
import { isUuid, readJson, requireWorkspaceMember } from '../../../../../lib/api-security'
import { PUNCH_SEVERITIES, canResolvePunchItem, summarizePunch } from '../../../../../lib/jobs/qc.ts'
import type { PunchSeverity } from '../../../../../lib/jobs/qc.ts'

const PUNCH_COLUMNS =
  'id,severity,location,description,status,created_by,created_at,resolved_by,resolved_at,resolution_note'

function failureStatus(code: string | undefined): number {
  if (code === '42501') return 403
  if (code === '23514' || code === '23503' || code === '22P02') return 400
  return 502
}

function text(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (trimmed.length > max) return null
  return trimmed
}

async function loadJob(supabase: Awaited<ReturnType<typeof createClient>>, id: string, workspaceId: string) {
  const { data, error } = await supabase
    .from('production_jobs')
    .select('id,status')
    .eq('id', id)
    .eq('workspace_id', workspaceId)
    .maybeSingle()
  return { job: data, error }
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

  const { job, error: jobError } = await loadJob(supabase, id, workspaceId)
  if (jobError) return NextResponse.json({ error: 'Could not load the production job.' }, { status: 502 })
  if (!job) return NextResponse.json({ error: 'Production job not found.' }, { status: 404 })

  const { data, error } = await supabase
    .from('production_job_punch_items')
    .select(PUNCH_COLUMNS)
    .eq('job_id', id)
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) return NextResponse.json({ error: 'Could not load the punch items.' }, { status: 502 })

  const rows = data ?? []
  return NextResponse.json({
    job,
    punch_items: rows,
    summary: summarizePunch(rows),
    note: 'Open critical punch items block the supervisor closeout and job completion. A resolved item is immutable.',
  })
}

export async function POST(
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

  const { job, error: jobError } = await loadJob(supabase, id, workspaceId)
  if (jobError) return NextResponse.json({ error: 'Could not load the production job.' }, { status: 502 })
  if (!job) return NextResponse.json({ error: 'Production job not found.' }, { status: 404 })
  if (job.status === 'completed' || job.status === 'cancelled') {
    return NextResponse.json({ error: 'A completed or cancelled job cannot take new punch items.' }, { status: 409 })
  }

  const parsed = await readJson(request, 8 * 1024)
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: parsed.status })
  const body = parsed.body

  if (typeof body.severity !== 'string' || !PUNCH_SEVERITIES.includes(body.severity as PunchSeverity)) {
    return NextResponse.json({ error: `severity must be one of ${PUNCH_SEVERITIES.join(', ')}.` }, { status: 400 })
  }
  const description = text(body.description, 1000)
  if (!description) {
    return NextResponse.json({ error: 'description must be between 1 and 1000 characters.' }, { status: 400 })
  }
  const location = text(body.location ?? '', 200)
  if (location === null) {
    return NextResponse.json({ error: 'location must be at most 200 characters.' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('production_job_punch_items')
    .insert({
      workspace_id: workspaceId,
      job_id: id,
      severity: body.severity,
      location,
      description,
      created_by: user.id,
    })
    .select(PUNCH_COLUMNS)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message || 'Could not record the punch item.' }, { status: failureStatus(error.code) })
  }

  return NextResponse.json({
    punch_item: data,
    note: 'Recorded. A critical item blocks closeout until it is resolved.',
  }, { status: 201 })
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

  const parsed = await readJson(request, 8 * 1024)
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: parsed.status })
  const body = parsed.body

  if (body.action !== 'resolve') {
    return NextResponse.json({ error: 'Unknown action.' }, { status: 400 })
  }
  if (!isUuid(body.punch_item_id)) {
    return NextResponse.json({ error: 'punch_item_id must be a valid UUID.' }, { status: 400 })
  }
  const resolutionNote = text(body.resolution_note ?? '', 1000)
  if (resolutionNote === null) {
    return NextResponse.json({ error: 'resolution_note must be at most 1000 characters.' }, { status: 400 })
  }

  const { job, error: jobError } = await loadJob(supabase, id, workspaceId)
  if (jobError) return NextResponse.json({ error: 'Could not load the production job.' }, { status: 502 })
  if (!job) return NextResponse.json({ error: 'Production job not found.' }, { status: 404 })
  if (job.status === 'completed' || job.status === 'cancelled') {
    return NextResponse.json({ error: 'A completed or cancelled job cannot resolve punch items.' }, { status: 409 })
  }

  const { data: current, error: loadError } = await supabase
    .from('production_job_punch_items')
    .select('id,status')
    .eq('id', body.punch_item_id)
    .eq('job_id', id)
    .eq('workspace_id', workspaceId)
    .maybeSingle()
  if (loadError) return NextResponse.json({ error: 'Could not load the punch item.' }, { status: 502 })
  if (!current) return NextResponse.json({ error: 'Punch item not found.' }, { status: 404 })
  if (!canResolvePunchItem(current.status)) {
    return NextResponse.json({ error: 'This punch item is already resolved.' }, { status: 409 })
  }

  const { data, error } = await supabase
    .from('production_job_punch_items')
    .update({ status: 'resolved', resolution_note: resolutionNote })
    .eq('id', current.id)
    .eq('job_id', id)
    .eq('workspace_id', workspaceId)
    .select(PUNCH_COLUMNS)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message || 'Could not resolve the punch item.' }, { status: failureStatus(error.code) })
  }

  return NextResponse.json({
    punch_item: data,
    note: 'The database stamped who resolved the item and when. The handoff snapshot did not change.',
  })
}
