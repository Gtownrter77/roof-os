/**
 * Daily field updates for one production job.
 *
 * Updates are append-only evidence. A member of the workspace can add one.
 * Nobody updates or deletes one, and adding one never changes the handoff
 * snapshot, the schedule, or any money record.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../../lib/supabase/server'
import { isUuid, readJson, requireWorkspaceMember } from '../../../../../lib/api-security'
import { isValidWorkDate } from '../../../../../lib/jobs/fieldwork.ts'

const UPDATE_COLUMNS =
  'id,work_date,note,percent_complete,blockers,created_by,created_at'

function failureStatus(code: string | undefined): number {
  if (code === '42501') return 403
  if (code === '23514' || code === '23503' || code === '22P02') return 400
  return 502
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
    .select('id,status')
    .eq('id', id)
    .eq('workspace_id', workspaceId)
    .maybeSingle()
  if (jobError) return NextResponse.json({ error: 'Could not load the production job.' }, { status: 502 })
  if (!job) return NextResponse.json({ error: 'Production job not found.' }, { status: 404 })

  const { data, error } = await supabase
    .from('production_job_updates')
    .select(UPDATE_COLUMNS)
    .eq('job_id', id)
    .eq('workspace_id', workspaceId)
    .order('work_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) return NextResponse.json({ error: 'Could not load the field updates.' }, { status: 502 })

  return NextResponse.json({
    job,
    updates: data ?? [],
    note: 'Daily updates are field evidence. They do not change the accepted amount, approved scope, or schedule.',
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

  const parsed = await readJson(request, 16 * 1024)
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
    return NextResponse.json({ error: 'A completed or cancelled job cannot take new field updates.' }, { status: 409 })
  }

  const today = new Date().toISOString().slice(0, 10)
  if (!isValidWorkDate(body.work_date, today)) {
    return NextResponse.json({ error: 'work_date must be a real date no later than today.' }, { status: 400 })
  }

  const note = typeof body.note === 'string' ? body.note.trim() : ''
  if (note.length === 0 || note.length > 2000) {
    return NextResponse.json({ error: 'note must be between 1 and 2000 characters.' }, { status: 400 })
  }

  let percentComplete: number | null = null
  if (body.percent_complete !== undefined && body.percent_complete !== null && body.percent_complete !== '') {
    const value = Number(body.percent_complete)
    if (!Number.isInteger(value) || value < 0 || value > 100) {
      return NextResponse.json({ error: 'percent_complete must be a whole number from 0 to 100.' }, { status: 400 })
    }
    percentComplete = value
  }

  const blockers = typeof body.blockers === 'string' ? body.blockers.trim() : ''
  if (blockers.length > 1000) {
    return NextResponse.json({ error: 'blockers must be at most 1000 characters.' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('production_job_updates')
    .insert({
      workspace_id: workspaceId,
      job_id: id,
      work_date: body.work_date,
      note,
      percent_complete: percentComplete,
      blockers,
      created_by: user.id,
    })
    .select(UPDATE_COLUMNS)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message || 'Could not record the field update.' }, { status: failureStatus(error.code) })
  }

  return NextResponse.json({
    update: data,
    note: 'Recorded. Field updates are append-only and do not change the handoff snapshot.',
  })
}
