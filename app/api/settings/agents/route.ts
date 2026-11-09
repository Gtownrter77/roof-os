import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'
import { readJson } from '../../../../lib/api-security'
import { mergeAgentToggles, parseAgentToggleUpdate } from '../../../../lib/agents/agent-toggles'

// Agent on/off switches for the current workspace. Everything goes through the signed-in
// user's client, so automation_rules row-level security decides who may write (system owner).

async function context() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, user: null, workspaceId: null }
  const { data: workspaceId } = await supabase.rpc('current_workspace_id')
  return { supabase, user, workspaceId: (workspaceId as string | null) ?? null }
}

export async function GET() {
  const { supabase, user, workspaceId } = await context()
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  if (!workspaceId) return NextResponse.json({ agents: mergeAgentToggles([]), canEdit: false })
  const { data, error } = await supabase
    .from('automation_rules')
    .select('agent_key,enabled,updated_at')
    .eq('workspace_id', workspaceId)
  if (error) return NextResponse.json({ error: 'Could not load agent switches.', detail: error.message }, { status: 502 })
  const { data: isOwner } = await supabase.rpc('is_system_owner')
  return NextResponse.json({ agents: mergeAgentToggles(data), canEdit: isOwner === true })
}

export async function PUT(request: NextRequest) {
  const { supabase, user, workspaceId } = await context()
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  if (!workspaceId) return NextResponse.json({ error: 'No workspace is configured.' }, { status: 400 })
  const { data: isAdmin, error: roleError } = await supabase.rpc('is_workspace_admin', { target_workspace: workspaceId })
  if (roleError) return NextResponse.json({ error: 'Workspace authorization could not be verified.' }, { status: 503 })
  if (!isAdmin) return NextResponse.json({ error: 'Workspace administrator access is required to change agent switches.' }, { status: 403 })
  const parsedBody = await readJson(request)
  if ('error' in parsedBody) return NextResponse.json({ error: parsedBody.error }, { status: parsedBody.status })
  const body = parsedBody.body as Record<string, unknown>
  const authorization = body.ownerAuthorization
  if (!authorization || typeof authorization !== 'object') {
    return NextResponse.json({ error: 'Owner 2-part authorization is required before settings can change.' }, { status: 403 })
  }
  const ownerEmail = String((authorization as { email?: unknown }).email ?? '').trim().toLowerCase()
  const confirmation = String((authorization as { confirmation?: unknown }).confirmation ?? '').trim()
  if (!user.email || ownerEmail !== user.email.toLowerCase()) {
    return NextResponse.json({ error: 'Part 1 failed. Owner email does not match the signed-in owner.' }, { status: 403 })
  }
  if (confirmation !== 'AUTHORIZE SETTINGS') {
    return NextResponse.json({ error: 'Part 2 failed. Type AUTHORIZE SETTINGS to confirm.' }, { status: 403 })
  }
  const update = parseAgentToggleUpdate(body)
  if ('error' in update) return NextResponse.json({ error: update.error }, { status: 400 })

  const { data, error } = await supabase
    .from('automation_rules')
    .update({ enabled: update.enabled, updated_at: new Date().toISOString() })
    .eq('workspace_id', workspaceId)
    .eq('agent_key', update.agentKey)
    .select('agent_key,enabled,updated_at')
  if (error) return NextResponse.json({ error: 'Agent switch save failed.', detail: error.message }, { status: 502 })
  // Row-level security filters a blocked update to zero rows instead of raising an error.
  if (!data || data.length === 0) {
    return NextResponse.json({ error: 'Only the system owner can change agent switches, or this agent has no rule row in this workspace yet.' }, { status: 403 })
  }
  return NextResponse.json({ saved: true, agent: mergeAgentToggles(data).find((agent) => agent.agentKey === update.agentKey) })
}
