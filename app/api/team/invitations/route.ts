import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  const { data: workspaceId, error: workspaceError } = await supabase.rpc('current_workspace_id')
  if (workspaceError || !workspaceId) return NextResponse.json({ error: 'No workspace is configured.' }, { status: 400 })
  const { data, error } = await supabase.from('workspace_invitations').select('id,email,role,status,expires_at,created_at').eq('workspace_id', workspaceId).order('created_at', { ascending: false }).limit(100)
  if (error) return NextResponse.json({ error: 'Could not load invitations.', detail: error.message }, { status: 502 })
  return NextResponse.json({ invitations: data ?? [] })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  const { data: workspaceId, error: workspaceError } = await supabase.rpc('current_workspace_id')
  if (workspaceError || !workspaceId) return NextResponse.json({ error: 'No workspace is configured.' }, { status: 400 })

  let body: { email?: string; role?: 'admin' | 'member' }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 }) }
  const email = body.email?.trim().toLowerCase() ?? ''
  const role = body.role ?? 'member'
  if (!EMAIL_RE.test(email)) return NextResponse.json({ error: 'A valid invite email is required.' }, { status: 400 })
  if (!['admin', 'member'].includes(role)) return NextResponse.json({ error: 'Role must be admin or member.' }, { status: 400 })
  if (email === user.email?.toLowerCase()) return NextResponse.json({ error: 'You are already a workspace member.' }, { status: 409 })

  const { data, error } = await supabase.from('workspace_invitations').insert({ workspace_id: workspaceId, email, role, invited_by: user.id }).select('id,email,role,status,expires_at,created_at').single()
  if (error) return NextResponse.json({ error: 'Invitation could not be created.', detail: error.message }, { status: error.code === '23505' ? 409 : 403 })
  return NextResponse.json({ invitation: data, delivery: 'pending', warning: 'The invitation record is ready; email delivery and acceptance flow still require implementation.' }, { status: 201 })
}
