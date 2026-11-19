import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'

const STEPS = ['self', 'inspector', 'closer', 'operations', 'owner'] as const

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  const { data: workspaceId } = await supabase.rpc('current_workspace_id')
  if (!workspaceId) return NextResponse.json({ error: 'No workspace is configured.' }, { status: 400 })
  const { data, error } = await supabase
    .from('workspace_members')
    .select('id,user_id,role,employee_layer,approval_sequence')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: true })
  if (error) return NextResponse.json({ error: 'Could not load the owner sequences.', detail: error.message }, { status: 502 })
  return NextResponse.json({ members: data ?? [] })
}

export async function PUT(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  const { data: workspaceId } = await supabase.rpc('current_workspace_id')
  if (!workspaceId) return NextResponse.json({ error: 'No workspace is configured.' }, { status: 400 })
  const { data: isAdmin, error: adminError } = await supabase.rpc('is_workspace_admin', { target_workspace: workspaceId })
  if (adminError) return NextResponse.json({ error: 'Workspace authorization could not be verified.' }, { status: 502 })
  if (!isAdmin) return NextResponse.json({ error: 'Only the owner sets the lockout sequence.' }, { status: 403 })

  const body = await request.json().catch(() => ({})) as { memberId?: string; sequence?: string[] }
  const sequence = Array.isArray(body.sequence) ? body.sequence.filter((step) => STEPS.includes(step as typeof STEPS[number])) : []
  if (!body.memberId || sequence.length < 1 || sequence.length > 4) {
    return NextResponse.json({ error: 'The owner sequence must be 1 to 4 steps: self, inspector, closer, operations, owner.' }, { status: 400 })
  }
  const { error } = await supabase
    .from('workspace_members')
    .update({ approval_sequence: sequence })
    .eq('id', body.memberId)
    .eq('workspace_id', workspaceId)
  if (error) return NextResponse.json({ error: 'Could not save the owner sequence.', detail: error.message }, { status: 502 })
  return NextResponse.json({ sequence })
}
