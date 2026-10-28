/**
 * Agent 5 — single supplement review draft.
 *
 * Members may read drafts in their own workspace. Approval and rejection are
 * owner/admin-only and only from 'ready_for_review'. Cross-workspace access is
 * denied by the workspace filter and by RLS. Nothing is sent to an insurer.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../../lib/supabase/server'
import { isUuid, readJson, requireWorkspaceMember } from '../../../../../lib/api-security'

const MAX_PACKET_PROPOSALS_FOR_RESPONSE = 1000

async function getWorkspaceContext() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, user: null, workspaceId: null }
  const { data: workspaceId } = await supabase.rpc('current_workspace_id')
  return { supabase, user, workspaceId: typeof workspaceId === 'string' ? workspaceId : null }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: 'A valid review draft id is required.' }, { status: 400 })

  const { supabase, user, workspaceId } = await getWorkspaceContext()
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  if (!workspaceId) return NextResponse.json({ error: 'No workspace is configured.' }, { status: 400 })

  const membership = await requireWorkspaceMember(supabase, user.id, workspaceId)
  if ('response' in membership) return membership.response

  const { data: isAdmin } = await supabase.rpc('is_workspace_admin', { target_workspace: workspaceId })
  // A draft outside the caller's workspace must look absent, not forbidden,
  // so the response does not confirm that another tenant's id exists.
  const { data, error } = await supabase
    .from('supplement_review_drafts')
    .select('id,document_id,revision,status,packet,created_by,created_at,approved_by,approved_at,updated_at')
    .eq('id', id)
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (error) return NextResponse.json({ error: 'Could not load the supplement review draft.' }, { status: 502 })
  if (!data) return NextResponse.json({ error: 'Supplement review draft not found.' }, { status: 404 })

  const packet = data.packet && typeof data.packet === 'object' ? data.packet as Record<string, unknown> : {}
  const proposals = Array.isArray(packet.proposals) ? packet.proposals.slice(0, MAX_PACKET_PROPOSALS_FOR_RESPONSE) : []

  return NextResponse.json({
    draft: { ...data, packet: { ...packet, proposals } },
    can_approve: isAdmin === true && data.status === 'ready_for_review',
    review_required: true,
    export_blocked: true,
    external_submission: false,
    note: 'Human review only. Approving this draft does not submit anything to an insurer.',
  })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: 'A valid review draft id is required.' }, { status: 400 })

  const { supabase, user, workspaceId } = await getWorkspaceContext()
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  if (!workspaceId) return NextResponse.json({ error: 'No workspace is configured.' }, { status: 400 })

  const membership = await requireWorkspaceMember(supabase, user.id, workspaceId)
  if ('response' in membership) return membership.response

  const { data: isAdmin, error: roleError } = await supabase.rpc('is_workspace_admin', {
    target_workspace: workspaceId,
  })
  if (roleError || isAdmin !== true) {
    return NextResponse.json({ error: 'Workspace owner or administrator access is required to review supplements.' }, { status: 403 })
  }

  const parsed = await readJson(request, 8 * 1024)
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: parsed.status })
  const body = parsed.body as Record<string, unknown>
  if (body.status !== 'approved' && body.status !== 'rejected') {
    return NextResponse.json({ error: 'status must be approved or rejected.' }, { status: 400 })
  }

  const { data: existing, error: existingError } = await supabase
    .from('supplement_review_drafts')
    .select('id,status')
    .eq('id', id)
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (existingError) return NextResponse.json({ error: 'Could not load the supplement review draft.' }, { status: 502 })
  if (!existing) return NextResponse.json({ error: 'Supplement review draft not found.' }, { status: 404 })
  if (existing.status !== 'ready_for_review') {
    return NextResponse.json({ error: 'Only a draft that is ready for review can be approved or rejected.' }, { status: 409 })
  }

  const reviewedAt = new Date().toISOString()
  const { data, error } = await supabase
    .from('supplement_review_drafts')
    .update({
      status: body.status,
      approved_by: body.status === 'approved' ? user.id : null,
      approved_at: body.status === 'approved' ? reviewedAt : null,
      updated_at: reviewedAt,
    })
    .eq('id', id)
    .eq('workspace_id', workspaceId)
    .eq('status', 'ready_for_review')
    .select('id,status,approved_at,updated_at')
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Could not update the supplement review draft.' }, { status: 502 })
  }

  return NextResponse.json({
    supplement_review: data,
    review_required: true,
    export_blocked: true,
    external_submission: false,
  })
}
