/**
 * Production job schedule API — crew assignments and material lines.
 *
 * Members read their workspace's schedule. Workspace owners/admins write it.
 * The job snapshot from migration 064 is never changed here: schedule rows only
 * describe who works when and which material is needed.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../../lib/supabase/server'
import { isUuid, readJson, requireWorkspaceMember } from '../../../../../lib/api-security'
import {
  ASSIGNMENT_ROLES,
  ASSIGNMENT_STATUSES,
  MATERIAL_STATUSES,
  isValidScheduleWindow,
  nextAssignmentStatuses,
  nextMaterialStatuses,
  summarizeSchedule,
} from '../../../../../lib/jobs/schedule'
import type { AssignmentRole, AssignmentStatus, MaterialStatus } from '../../../../../lib/jobs/schedule'

const MAX_NOTES = 500
const MAX_VENDOR = 120
const MAX_DESCRIPTION = 300

async function getWorkspaceContext() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, user: null, workspaceId: null }
  const { data: workspaceId } = await supabase.rpc('current_workspace_id')
  return { supabase, user, workspaceId: typeof workspaceId === 'string' ? workspaceId : null }
}

function text(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (trimmed.length === 0) return ''
  if (trimmed.length > max) return null
  return trimmed
}

function failureStatus(code: string | undefined): number {
  if (code === '23505') return 409
  if (code === '23514' || code === '23503' || code === '42501' || code === '22P02') return 400
  return 502
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: 'A valid production job id is required.' }, { status: 400 })

  const { supabase, user, workspaceId } = await getWorkspaceContext()
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  if (!workspaceId) return NextResponse.json({ error: 'No workspace is configured.' }, { status: 400 })

  const membership = await requireWorkspaceMember(supabase, user.id, workspaceId)
  if ('response' in membership) return membership.response

  const { data: job, error: jobError } = await supabase
    .from('production_jobs')
    .select('id,job_number,customer_name,property_address,status,accepted_total,accepted_at,scope_item_count,approved_scope')
    .eq('id', id)
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (jobError) return NextResponse.json({ error: 'Could not load the production job.' }, { status: 502 })
  if (!job) return NextResponse.json({ error: 'Production job not found.' }, { status: 404 })

  const [{ data: assignments, error: assignmentError }, { data: materials, error: materialError }] = await Promise.all([
    supabase
      .from('production_job_assignments')
      .select('id,job_id,member_user_id,role,scheduled_start,scheduled_end,status,notes,created_at,updated_at')
      .eq('job_id', id)
      .eq('workspace_id', workspaceId)
      .order('scheduled_start', { ascending: true }),
    supabase
      .from('production_job_materials')
      .select('id,job_id,line_item_id,description,quantity,unit,status,needed_by,vendor,notes,created_at,updated_at')
      .eq('job_id', id)
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: true }),
  ])

  if (assignmentError || materialError) {
    return NextResponse.json({ error: 'Could not load the production schedule.' }, { status: 502 })
  }

  const { data: isAdmin } = await supabase.rpc('is_workspace_admin', { target_workspace: workspaceId })
  const { data: members } = await supabase
    .from('workspace_members')
    .select('user_id,role')
    .eq('workspace_id', workspaceId)
    .order('role', { ascending: true })

  return NextResponse.json({
    job,
    assignments: assignments ?? [],
    materials: materials ?? [],
    members: members ?? [],
    readiness: summarizeSchedule(assignments ?? [], materials ?? []),
    can_edit: isAdmin === true,
    note: 'Schedule rows are operational. They do not change the handoff amount, scope, or warranty.',
  })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: 'A valid production job id is required.' }, { status: 400 })

  const { supabase, user, workspaceId } = await getWorkspaceContext()
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  if (!workspaceId) return NextResponse.json({ error: 'No workspace is configured.' }, { status: 400 })

  const membership = await requireWorkspaceMember(supabase, user.id, workspaceId)
  if ('response' in membership) return membership.response

  const { data: isAdmin } = await supabase.rpc('is_workspace_admin', { target_workspace: workspaceId })
  if (isAdmin !== true) {
    return NextResponse.json({ error: 'Workspace owner or administrator access is required to edit the schedule.' }, { status: 403 })
  }

  const parsed = await readJson(request, 16 * 1024)
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: parsed.status })
  const body = parsed.body as Record<string, unknown>

  const { data: job, error: jobError } = await supabase
    .from('production_jobs')
    .select('id,estimate_id,status')
    .eq('id', id)
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (jobError) return NextResponse.json({ error: 'Could not load the production job.' }, { status: 502 })
  if (!job) return NextResponse.json({ error: 'Production job not found.' }, { status: 404 })
  if (job.status === 'cancelled' || job.status === 'completed') {
    return NextResponse.json({ error: 'A completed or cancelled job cannot take new schedule rows.' }, { status: 409 })
  }

  if (body.action === 'add_assignment') {
    if (!isUuid(body.member_user_id)) {
      return NextResponse.json({ error: 'A valid workspace member is required.' }, { status: 400 })
    }
    if (typeof body.role !== 'string' || !ASSIGNMENT_ROLES.includes(body.role as AssignmentRole)) {
      return NextResponse.json({ error: `role must be one of ${ASSIGNMENT_ROLES.join(', ')}.` }, { status: 400 })
    }
    if (typeof body.scheduled_start !== 'string' || typeof body.scheduled_end !== 'string'
      || !isValidScheduleWindow(body.scheduled_start, body.scheduled_end)) {
      return NextResponse.json({ error: 'scheduled_end must be after scheduled_start.' }, { status: 400 })
    }
    const notes = body.notes === undefined ? '' : text(body.notes, MAX_NOTES)
    if (notes === null) return NextResponse.json({ error: `notes must be at most ${MAX_NOTES} characters.` }, { status: 400 })

    const { data, error } = await supabase
      .from('production_job_assignments')
      .insert({
        workspace_id: workspaceId,
        job_id: id,
        member_user_id: body.member_user_id,
        role: body.role,
        scheduled_start: new Date(body.scheduled_start).toISOString(),
        scheduled_end: new Date(body.scheduled_end).toISOString(),
        notes,
        created_by: user.id,
      })
      .select('id,member_user_id,role,scheduled_start,scheduled_end,status,notes,created_at')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message || 'Could not add the assignment.' }, { status: failureStatus(error.code) })
    }
    return NextResponse.json({ assignment: data }, { status: 201 })
  }

  if (body.action === 'add_material') {
    const lineItemId = body.line_item_id === undefined || body.line_item_id === null || body.line_item_id === ''
      ? null
      : body.line_item_id
    if (lineItemId !== null && !isUuid(lineItemId)) {
      return NextResponse.json({ error: 'line_item_id must be a valid id or omitted.' }, { status: 400 })
    }
    const description = text(body.description, MAX_DESCRIPTION)
    if (!description) {
      return NextResponse.json({ error: `description is required and must be at most ${MAX_DESCRIPTION} characters.` }, { status: 400 })
    }
    const unit = text(body.unit, 16)
    if (!unit) return NextResponse.json({ error: 'unit is required.' }, { status: 400 })
    const quantity = typeof body.quantity === 'number' ? body.quantity : Number(body.quantity)
    if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 100000) {
      return NextResponse.json({ error: 'quantity must be greater than 0.' }, { status: 400 })
    }
    const vendor = body.vendor === undefined ? '' : text(body.vendor, MAX_VENDOR)
    if (vendor === null) return NextResponse.json({ error: `vendor must be at most ${MAX_VENDOR} characters.` }, { status: 400 })
    const notes = body.notes === undefined ? '' : text(body.notes, MAX_NOTES)
    if (notes === null) return NextResponse.json({ error: `notes must be at most ${MAX_NOTES} characters.` }, { status: 400 })
    let neededBy: string | null = null
    if (body.needed_by !== undefined && body.needed_by !== null && body.needed_by !== '') {
      if (typeof body.needed_by !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.needed_by)
        || !Number.isFinite(Date.parse(body.needed_by))) {
        return NextResponse.json({ error: 'needed_by must be a YYYY-MM-DD date.' }, { status: 400 })
      }
      neededBy = body.needed_by
    }

    const { data, error } = await supabase
      .from('production_job_materials')
      .insert({
        workspace_id: workspaceId,
        job_id: id,
        line_item_id: lineItemId,
        description,
        quantity,
        unit,
        vendor,
        needed_by: neededBy,
        notes,
        created_by: user.id,
      })
      .select('id,line_item_id,description,quantity,unit,status,needed_by,vendor,notes,created_at')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message || 'Could not add the material line.' }, { status: failureStatus(error.code) })
    }
    return NextResponse.json({ material: data }, { status: 201 })
  }

  return NextResponse.json({ error: 'Unknown action.' }, { status: 400 })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: 'A valid production job id is required.' }, { status: 400 })

  const { supabase, user, workspaceId } = await getWorkspaceContext()
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  if (!workspaceId) return NextResponse.json({ error: 'No workspace is configured.' }, { status: 400 })

  const membership = await requireWorkspaceMember(supabase, user.id, workspaceId)
  if ('response' in membership) return membership.response

  const { data: isAdmin } = await supabase.rpc('is_workspace_admin', { target_workspace: workspaceId })
  if (isAdmin !== true) {
    return NextResponse.json({ error: 'Workspace owner or administrator access is required to edit the schedule.' }, { status: 403 })
  }

  const parsed = await readJson(request, 16 * 1024)
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: parsed.status })
  const body = parsed.body as Record<string, unknown>

  if (body.action === 'set_assignment_status') {
    if (!isUuid(body.assignment_id) || typeof body.status !== 'string'
      || !ASSIGNMENT_STATUSES.includes(body.status as AssignmentStatus)) {
      return NextResponse.json({ error: 'A valid assignment and status are required.' }, { status: 400 })
    }
    const { data: current, error: loadError } = await supabase
      .from('production_job_assignments')
      .select('id,status')
      .eq('id', body.assignment_id)
      .eq('job_id', id)
      .eq('workspace_id', workspaceId)
      .maybeSingle()
    if (loadError) return NextResponse.json({ error: 'Could not load the assignment.' }, { status: 502 })
    if (!current) return NextResponse.json({ error: 'Assignment not found.' }, { status: 404 })
    if (!nextAssignmentStatuses(current.status).includes(body.status as AssignmentStatus)) {
      return NextResponse.json({ error: `Cannot move an assignment from ${current.status} to ${body.status}.` }, { status: 409 })
    }
    const { data, error } = await supabase
      .from('production_job_assignments')
      .update({ status: body.status })
      .eq('id', body.assignment_id)
      .eq('workspace_id', workspaceId)
      .select('id,status,updated_at')
      .single()
    if (error) {
      return NextResponse.json({ error: error.message || 'Could not update the assignment.' }, { status: failureStatus(error.code) })
    }
    return NextResponse.json({ assignment: data })
  }

  if (body.action === 'set_material_status') {
    if (!isUuid(body.material_id) || typeof body.status !== 'string'
      || !MATERIAL_STATUSES.includes(body.status as MaterialStatus)) {
      return NextResponse.json({ error: 'A valid material line and status are required.' }, { status: 400 })
    }
    const { data: current, error: loadError } = await supabase
      .from('production_job_materials')
      .select('id,status')
      .eq('id', body.material_id)
      .eq('job_id', id)
      .eq('workspace_id', workspaceId)
      .maybeSingle()
    if (loadError) return NextResponse.json({ error: 'Could not load the material line.' }, { status: 502 })
    if (!current) return NextResponse.json({ error: 'Material line not found.' }, { status: 404 })
    if (!nextMaterialStatuses(current.status).includes(body.status as MaterialStatus)) {
      return NextResponse.json({ error: `Cannot move a material line from ${current.status} to ${body.status}.` }, { status: 409 })
    }
    const { data, error } = await supabase
      .from('production_job_materials')
      .update({ status: body.status })
      .eq('id', body.material_id)
      .eq('workspace_id', workspaceId)
      .select('id,status,updated_at')
      .single()
    if (error) {
      return NextResponse.json({ error: error.message || 'Could not update the material line.' }, { status: failureStatus(error.code) })
    }
    return NextResponse.json({ material: data })
  }

  return NextResponse.json({ error: 'Unknown action.' }, { status: 400 })
}
