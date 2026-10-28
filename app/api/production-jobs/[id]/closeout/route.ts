/**
 * Supervisor closeout for one production job.
 *
 * A closeout is one immutable record. It can only be recorded by a workspace
 * owner or administrator, only while the job is in progress, and only when no
 * critical punch item is open. The database stamps the supervisor, the time,
 * and the open punch counts.
 *
 * Completion of the job is gated on this record and on a fresh check for open
 * critical items. Nothing here changes the handoff, the schedule, a money
 * record, or a customer record.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../../lib/supabase/server'
import { isUuid, readJson, requireWorkspaceMember } from '../../../../../lib/api-security'
import { evaluateCloseoutGate, summarizePunch } from '../../../../../lib/jobs/qc.ts'
import type { PunchItemLike } from '../../../../../lib/jobs/qc.ts'

const CLOSEOUT_COLUMNS =
  'id,closed_by,closed_at,note,open_critical_count,open_total_count,created_at'

function failureStatus(code: string | undefined): number {
  if (code === '42501') return 403
  if (code === '23505') return 409
  if (code === '23514' || code === '23503' || code === '22P02') return 409
  return 502
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

  const { data: punchRows, error: punchError } = await supabase
    .from('production_job_punch_items')
    .select('severity,status')
    .eq('job_id', id)
    .eq('workspace_id', workspaceId)
  if (punchError) return NextResponse.json({ error: 'Could not load the punch items.' }, { status: 502 })

  const { data: closeout, error: closeoutError } = await supabase
    .from('production_job_closeouts')
    .select(CLOSEOUT_COLUMNS)
    .eq('job_id', id)
    .eq('workspace_id', workspaceId)
    .maybeSingle()
  if (closeoutError) return NextResponse.json({ error: 'Could not load the closeout.' }, { status: 502 })

  const { data: isAdmin } = await supabase.rpc('is_workspace_admin', { target_workspace: workspaceId })
  const gate = evaluateCloseoutGate((punchRows ?? []) as PunchItemLike[])

  return NextResponse.json({
    job,
    closeout: closeout ?? null,
    gate,
    punch_summary: summarizePunch((punchRows ?? []) as PunchItemLike[]),
    can_close: isAdmin === true && closeout === null && job.status === 'in_progress',
    note: 'A supervisor closeout is required before the job can be completed. It is not a warranty, an invoice, or a final payment.',
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

  const { data: isAdmin } = await supabase.rpc('is_workspace_admin', { target_workspace: workspaceId })
  if (isAdmin !== true) {
    return NextResponse.json({ error: 'Workspace owner or administrator access is required to record a closeout.' }, { status: 403 })
  }

  const parsed = await readJson(request, 8 * 1024)
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: parsed.status })
  const body = parsed.body

  const note = typeof body.note === 'string' ? body.note.trim() : ''
  if (note.length > 2000) {
    return NextResponse.json({ error: 'note must be at most 2000 characters.' }, { status: 400 })
  }

  const { job, error: jobError } = await loadJob(supabase, id, workspaceId)
  if (jobError) return NextResponse.json({ error: 'Could not load the production job.' }, { status: 502 })
  if (!job) return NextResponse.json({ error: 'Production job not found.' }, { status: 404 })
  if (job.status !== 'in_progress') {
    return NextResponse.json({ error: 'A supervisor closeout can only be recorded while the job is in progress.' }, { status: 409 })
  }

  const { data: punchRows, error: punchError } = await supabase
    .from('production_job_punch_items')
    .select('severity,status')
    .eq('job_id', id)
    .eq('workspace_id', workspaceId)
  if (punchError) return NextResponse.json({ error: 'Could not load the punch items.' }, { status: 502 })

  const gate = evaluateCloseoutGate((punchRows ?? []) as PunchItemLike[])
  if (!gate.can_close) {
    return NextResponse.json({ error: gate.blockers[0] }, { status: 409 })
  }

  const { data, error } = await supabase
    .from('production_job_closeouts')
    .insert({
      workspace_id: workspaceId,
      job_id: id,
      closed_by: user.id,
      note,
      open_critical_count: 0,
      open_total_count: gate.open_total,
    })
    .select(CLOSEOUT_COLUMNS)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message || 'Could not record the closeout.' }, { status: failureStatus(error.code) })
  }

  return NextResponse.json({
    closeout: data,
    note: 'The database stamped who closed out and when. Completion is still a separate status move.',
  }, { status: 201 })
}
