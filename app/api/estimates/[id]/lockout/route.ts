import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../../lib/supabase/server'

const STEPS = ['self', 'inspector', 'closer', 'operations', 'owner'] as const

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  const { data: workspaceId } = await supabase.rpc('current_workspace_id')
  if (!workspaceId) return NextResponse.json({ error: 'No workspace is configured.' }, { status: 400 })
  const { id } = await params

  const { data: estimate, error: loadError } = await supabase
    .from('estimates')
    .select('id,status,created_by,approval_tags')
    .eq('id', id)
    .eq('workspace_id', workspaceId)
    .maybeSingle()
  if (loadError) return NextResponse.json({ error: 'Could not load estimate.' }, { status: 502 })
  if (!estimate) return NextResponse.json({ error: 'Estimate not found.' }, { status: 404 })

  const { data: membership, error: memberError } = await supabase
    .from('workspace_members')
    .select('role,employee_layer')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (memberError) return NextResponse.json({ error: 'Workspace authorization could not be verified.' }, { status: 502 })
  const layer = membership?.employee_layer || membership?.role || ''
  if (!['owner', 'admin', 'operations', 'inspector', 'closer'].includes(layer)) {
    return NextResponse.json({ error: 'Your layer cannot tag an estimate. The owner sets the sequence.' }, { status: 403 })
  }

  const { data: author } = await supabase
    .from('workspace_members')
    .select('approval_sequence')
    .eq('workspace_id', workspaceId)
    .eq('user_id', estimate.created_by)
    .maybeSingle()
  const sequence = Array.isArray(author?.approval_sequence) && author.approval_sequence.length
    ? author.approval_sequence.filter((step: unknown) => STEPS.includes(step as typeof STEPS[number]))
    : ['self']
  const tags = Array.isArray(estimate.approval_tags) ? estimate.approval_tags : []
  const next = sequence[tags.length]
  if (!next) return NextResponse.json({ error: 'Every lock in the owner sequence is already tagged.' }, { status: 409 })
  const allowed = next === 'self' ? layer : next === layer || layer === 'owner' || layer === 'admin'
  if (!allowed) return NextResponse.json({ error: `The next lock requires ${next}. The owner set this sequence.` }, { status: 403 })

  const tagged = [...tags, { step: next, layer, user_id: user.id, tagged_at: new Date().toISOString() }]
  const complete = tagged.length >= sequence.length
  const { error: updateError } = await supabase
    .from('estimates')
    .update({
      approval_tags: tagged,
      status: complete ? 'approved' : 'pending_approval',
      approved_by: complete ? user.id : null,
      approved_at: complete ? new Date().toISOString() : null,
    })
    .eq('id', id)
    .eq('workspace_id', workspaceId)
  if (updateError) return NextResponse.json({ error: 'Could not tag this lock.', detail: updateError.message }, { status: 502 })
  return NextResponse.json({ sequence, tags: tagged, complete })
}
