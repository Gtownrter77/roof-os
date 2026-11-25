import { NextRequest, NextResponse } from 'next/server'
import { isUuid, readJson, requireWorkspaceMember } from '../../../../lib/api-security'
import { createClient } from '../../../../lib/supabase/server'
import { disableDecision } from '../../../../lib/jarvis/api/index'

const NO_STORE = { 'Cache-Control': 'private, no-store, max-age=0' }

/** Workspace-wide kill switch. Admin-only; cancels all queued adjuster work. */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  const { data: workspaceId, error: workspaceError } = await supabase.rpc('current_workspace_id')
  if (workspaceError || !isUuid(workspaceId)) {
    return NextResponse.json({ error: 'Workspace could not be verified.' }, { status: 403 })
  }
  const membership = await requireWorkspaceMember(supabase, user.id, workspaceId)
  if (membership.response) return membership.response
  const { data: isAdmin, error: roleError } = await supabase.rpc('is_workspace_admin', { target_workspace: workspaceId })
  if (roleError) return NextResponse.json({ error: 'Workspace role could not be verified.' }, { status: 503 })
  if (!isAdmin) return NextResponse.json({ error: 'Workspace admin required.' }, { status: 403 })

  const parsed = await readJson(request, 8 * 1024)
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: parsed.status })
  const body = (parsed.body as Record<string, unknown>) ?? {}
  const enabled = body.enabled === undefined ? false : body.enabled === true
  const decision = disableDecision({ kind: 'workspace', workspaceId })
  const args = enabled ? { ...decision.args, p_enabled: true } : decision.args
  const { error } = await supabase.rpc(decision.function, args)
  if (error) {
    return NextResponse.json({ error: 'Workspace adjuster control could not be applied.' }, { status: 502, headers: NO_STORE })
  }
  return NextResponse.json({ workspaceId, enabled }, { headers: NO_STORE })
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  const { data: workspaceId, error: workspaceError } = await supabase.rpc('current_workspace_id')
  if (workspaceError || !isUuid(workspaceId)) {
    return NextResponse.json({ error: 'Workspace could not be verified.' }, { status: 403 })
  }
  const membership = await requireWorkspaceMember(supabase, user.id, workspaceId)
  if (membership.response) return membership.response
  const { data, error } = await supabase
    .from('workspace_adjuster_settings')
    .select('adjuster_enabled,plan_only,identity_id')
    .eq('workspace_id', workspaceId)
    .maybeSingle()
  if (error) return NextResponse.json({ error: 'Adjuster settings could not be loaded.' }, { status: 502, headers: NO_STORE })
  return NextResponse.json({
    adjusterEnabled: data?.adjuster_enabled ?? null,
    planOnly: data?.plan_only ?? null,
    identityId: data?.identity_id ?? '',
  }, { headers: NO_STORE })
}
