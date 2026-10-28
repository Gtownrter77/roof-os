/**
 * Production job status transitions.
 *
 * The status moves are owned by the database (migration 064). This route adds
 * the Day 23 closeout gate on top: a job cannot be completed without a
 * supervisor closeout, and no critical punch item may be open at completion.
 * Both rules are enforced in the database; this route only surfaces them.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../../lib/supabase/server'
import { isUuid, readJson, requireWorkspaceMember } from '../../../../../lib/api-security'
import {
  PRODUCTION_JOB_STATUSES,
  nextProductionJobStatuses,
} from '../../../../../lib/jobs/production.ts'
import type { ProductionJobStatus } from '../../../../../lib/jobs/production.ts'

function failureStatus(code: string | undefined): number {
  if (code === '42501') return 403
  if (code === '23514' || code === '23503' || code === '22P02') return 409
  return 502
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
    return NextResponse.json({ error: 'Workspace owner or administrator access is required to move a production job.' }, { status: 403 })
  }

  const parsed = await readJson(request, 8 * 1024)
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: parsed.status })
  const body = parsed.body

  if (typeof body.status !== 'string'
    || !PRODUCTION_JOB_STATUSES.includes(body.status as ProductionJobStatus)) {
    return NextResponse.json({ error: `status must be one of ${PRODUCTION_JOB_STATUSES.join(', ')}.` }, { status: 400 })
  }
  const target = body.status as ProductionJobStatus

  const { data: job, error: jobError } = await supabase
    .from('production_jobs')
    .select('id,status')
    .eq('id', id)
    .eq('workspace_id', workspaceId)
    .maybeSingle()
  if (jobError) return NextResponse.json({ error: 'Could not load the production job.' }, { status: 502 })
  if (!job) return NextResponse.json({ error: 'Production job not found.' }, { status: 404 })

  if (!nextProductionJobStatuses(job.status).includes(target)) {
    return NextResponse.json({
      error: `Invalid production job status transition from ${job.status} to ${target}.`,
    }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('production_jobs')
    .update({ status: target })
    .eq('id', id)
    .eq('workspace_id', workspaceId)
    .select('id,status')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message || 'Could not move the production job.' }, { status: failureStatus(error.code) })
  }

  return NextResponse.json({
    job: data,
    note: 'Status moves are recorded on the job. Completion requires a supervisor closeout and no unresolved critical punch items.',
  })
}
