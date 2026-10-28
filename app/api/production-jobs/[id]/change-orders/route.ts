/**
 * Change-order review for one production job.
 *
 * A workspace member requests a scope or price change. A workspace owner or
 * administrator approves or declines it. The database stamps the decider and
 * the decision time, and a decided change order is immutable.
 *
 * An approved change order is a separate invoice input. It never rewrites the
 * handoff accepted total or approved scope, and it never contacts a customer.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../../lib/supabase/server'
import { isUuid, readJson, requireWorkspaceMember } from '../../../../../lib/api-security'
import {
  CHANGE_ORDER_DECISIONS,
  nextChangeOrderDecisions,
  summarizeChangeOrders,
} from '../../../../../lib/jobs/fieldwork.ts'
import type { ChangeOrderDecision } from '../../../../../lib/jobs/fieldwork.ts'

const CHANGE_ORDER_COLUMNS =
  'id,requested_by,description,reason,amount_delta,status,decided_by,decided_at,decision_note,created_at,updated_at'

function failureStatus(code: string | undefined): number {
  if (code === '42501') return 403
  if (code === '23514' || code === '23503' || code === '22P02') return 400
  return 502
}

function boundedText(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (trimmed.length > max) return null
  return trimmed
}

function parsedAmount(value: unknown): number | null {
  if (typeof value !== 'number' && typeof value !== 'string') return null
  const text = typeof value === 'string' ? value.trim() : value
  if (text === '') return null
  const amount = Number(text)
  if (!Number.isFinite(amount)) return null
  if (amount === 0) return null
  if (Math.abs(amount) > 100_000_000) return null
  if (Math.abs(amount * 100 - Math.round(amount * 100)) > 1e-9) return null
  return Math.round(amount * 100) / 100
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
    .from('production_job_change_orders')
    .select(CHANGE_ORDER_COLUMNS)
    .eq('job_id', id)
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) return NextResponse.json({ error: 'Could not load the change orders.' }, { status: 502 })

  const rows = data ?? []
  const { data: isAdmin } = await supabase.rpc('is_workspace_admin', { target_workspace: workspaceId })

  return NextResponse.json({
    job,
    change_orders: rows,
    summary: summarizeChangeOrders(rows),
    can_decide: isAdmin === true,
    note: 'An approved change order is a separate invoice input. It never changes the accepted total or approved scope on the handoff.',
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
    return NextResponse.json({ error: 'A completed or cancelled job cannot take a new change order.' }, { status: 409 })
  }

  const parsed = await readJson(request, 16 * 1024)
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: parsed.status })
  const body = parsed.body

  const description = boundedText(body.description, 1000)
  if (!description) {
    return NextResponse.json({ error: 'description must be between 1 and 1000 characters.' }, { status: 400 })
  }
  const reason = boundedText(body.reason ?? '', 1000)
  if (reason === null) {
    return NextResponse.json({ error: 'reason must be at most 1000 characters.' }, { status: 400 })
  }
  const amount = parsedAmount(body.amount_delta)
  if (amount === null) {
    return NextResponse.json({ error: 'amount_delta must be a nonzero amount with at most two decimals.' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('production_job_change_orders')
    .insert({
      workspace_id: workspaceId,
      job_id: id,
      requested_by: user.id,
      description,
      reason,
      amount_delta: amount,
    })
    .select(CHANGE_ORDER_COLUMNS)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message || 'Could not request the change order.' }, { status: failureStatus(error.code) })
  }

  return NextResponse.json({
    change_order: data,
    note: 'Requested. An owner or administrator must approve or decline it. Nothing was changed on the handoff.',
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
    return NextResponse.json({ error: 'Workspace owner or administrator access is required to decide a change order.' }, { status: 403 })
  }

  const parsed = await readJson(request, 8 * 1024)
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: parsed.status })
  const body = parsed.body

  if (body.action !== 'decide') {
    return NextResponse.json({ error: 'Unknown action.' }, { status: 400 })
  }
  if (typeof body.decision !== 'string' || !CHANGE_ORDER_DECISIONS.includes(body.decision as ChangeOrderDecision)) {
    return NextResponse.json({ error: `decision must be one of ${CHANGE_ORDER_DECISIONS.join(', ')}.` }, { status: 400 })
  }
  if (!isUuid(body.change_order_id)) {
    return NextResponse.json({ error: 'change_order_id must be a valid UUID.' }, { status: 400 })
  }
  const decisionNote = boundedText(body.decision_note ?? '', 1000)
  if (decisionNote === null) {
    return NextResponse.json({ error: 'decision_note must be at most 1000 characters.' }, { status: 400 })
  }

  const { job, error: jobError } = await loadJob(supabase, id, workspaceId)
  if (jobError) return NextResponse.json({ error: 'Could not load the production job.' }, { status: 502 })
  if (!job) return NextResponse.json({ error: 'Production job not found.' }, { status: 404 })
  if (job.status === 'completed' || job.status === 'cancelled') {
    return NextResponse.json({ error: 'A completed or cancelled job cannot take a change-order decision.' }, { status: 409 })
  }

  const { data: current, error: loadError } = await supabase
    .from('production_job_change_orders')
    .select('id,status')
    .eq('id', body.change_order_id)
    .eq('job_id', id)
    .eq('workspace_id', workspaceId)
    .maybeSingle()
  if (loadError) return NextResponse.json({ error: 'Could not load the change order.' }, { status: 502 })
  if (!current) return NextResponse.json({ error: 'Change order not found.' }, { status: 404 })

  const decision = body.decision as ChangeOrderDecision
  if (!nextChangeOrderDecisions(current.status).includes(decision)) {
    return NextResponse.json({ error: 'This change order already has a decision.' }, { status: 409 })
  }

  const { data, error } = await supabase
    .from('production_job_change_orders')
    .update({ status: decision, decision_note: decisionNote })
    .eq('id', current.id)
    .eq('job_id', id)
    .eq('workspace_id', workspaceId)
    .select(CHANGE_ORDER_COLUMNS)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message || 'Could not record the decision.' }, { status: failureStatus(error.code) })
  }

  return NextResponse.json({
    change_order: data,
    note: 'The database stamped who decided and when. The handoff snapshot was not changed.',
  })
}
