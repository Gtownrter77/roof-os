import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'
import { createAdminClient } from '../../../../lib/supabase/admin'
import { readJson } from '../../../../lib/api-security'
import { INVITE_LAYERS, layerToWorkspaceRole, type EmployeeLayer } from '../../../../lib/employee-layers'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  const { data: workspaceId, error: workspaceError } = await supabase.rpc('current_workspace_id')
  if (workspaceError || !workspaceId) return NextResponse.json({ error: 'No workspace is configured.' }, { status: 400 })
  const { data: isAdmin } = await supabase.rpc('is_workspace_admin', { target_workspace: workspaceId })
  if (!isAdmin) return NextResponse.json({ error: 'Workspace administrator access is required to view invitations.' }, { status: 403 })
  const { data, error } = await supabase.from('workspace_invitations').select('id,email,role,employee_layer,status,expires_at,created_at').eq('workspace_id', workspaceId).order('created_at', { ascending: false }).limit(100)
  if (error) return NextResponse.json({ error: 'Could not load invitations.', detail: error.message }, { status: 502 })
  return NextResponse.json({ invitations: data ?? [] })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  const { data: workspaceId, error: workspaceError } = await supabase.rpc('current_workspace_id')
  if (workspaceError || !workspaceId) return NextResponse.json({ error: 'No workspace is configured.' }, { status: 400 })
  const { data: isAdmin, error: roleError } = await supabase.rpc('is_workspace_admin', { target_workspace: workspaceId })
  if (roleError || isAdmin !== true) return NextResponse.json({ error: 'Workspace administrator access is required to invite members.' }, { status: 403 })

  const parsedBody = await readJson(request)
  if ('error' in parsedBody) return NextResponse.json({ error: parsedBody.error }, { status: parsedBody.status })
  const body = parsedBody.body as { email?: string; employeeLayer?: EmployeeLayer; role?: 'admin' | 'member' }
  const email = body.email?.trim().toLowerCase() ?? ''
  const employeeLayer = INVITE_LAYERS.some((layer) => layer.id === body.employeeLayer) ? body.employeeLayer : null
  if (!employeeLayer) return NextResponse.json({ error: 'Layer must be operations, inspector, closer, canvasser, or production.' }, { status: 400 })
  const role = layerToWorkspaceRole(employeeLayer as EmployeeLayer)
  if (!EMAIL_RE.test(email)) return NextResponse.json({ error: 'A valid invite email is required.' }, { status: 400 })
  if (email === user.email?.toLowerCase()) return NextResponse.json({ error: 'You are already a workspace member.' }, { status: 409 })

  const { data, error } = await supabase.from('workspace_invitations').insert({ workspace_id: workspaceId, email, role, employee_layer: employeeLayer, invited_by: user.id }).select('id,email,role,employee_layer,status,expires_at,created_at').single()
  if (error) return NextResponse.json({ error: 'Invitation could not be created.', detail: error.message }, { status: error.code === '23505' ? 409 : 403 })

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim()
    || process.env.NEXT_PUBLIC_SUPABASE_SITE_URL?.trim()
    || process.env.NEXT_PUBLIC_APP_URL?.trim()
    || process.env.RECEPTIONIST_PUBLIC_URL?.trim()
  if (!siteUrl) {
    await supabase.from('workspace_invitations').update({ status: 'revoked', updated_at: new Date().toISOString() }).eq('id', data.id)
    return NextResponse.json({ error: 'Invitation email delivery is not configured.' }, { status: 503 })
  }

  try {
    const admin = createAdminClient()
    const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${siteUrl.replace(/\/$/, '')}/auth/callback?next=/team/invitations/accept&invitationId=${encodeURIComponent(data.id)}`,
    })
    if (inviteError) throw inviteError
  } catch (inviteError) {
    await supabase.from('workspace_invitations').update({ status: 'revoked', updated_at: new Date().toISOString() }).eq('id', data.id)
    return NextResponse.json({ error: 'Invitation was recorded but email delivery failed.', detail: inviteError instanceof Error ? inviteError.message : 'Unknown delivery error.' }, { status: 502 })
  }

  return NextResponse.json({ invitation: data, delivery: 'sent' }, { status: 201 })
}
