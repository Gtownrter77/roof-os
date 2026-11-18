import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'
import { readJson } from '../../../../lib/api-security'

const ROLE_KEYS = new Set(['owner', 'admin', 'operations', 'inspector', 'closer', 'canvasser', 'production', 'member'])
const LEVELS = new Set(['read', 'prepare', 'approve', 'execute', 'coordinate', 'sustain', 'release'])
const CAPABILITIES = new Set(['read', 'prepare', 'approve', 'execute', 'coordinate', 'sustain', 'release'])

async function getContext() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, user: null, workspaceId: null, error: NextResponse.json({ error: 'Authentication required.' }, { status: 401 }) }
  const { data: workspaceId, error } = await supabase.rpc('current_workspace_id')
  if (error || typeof workspaceId !== 'string') return { supabase, user, workspaceId: null, error: NextResponse.json({ error: 'No active workspace is configured.' }, { status: 400 }) }
  const { data: member, error: memberError } = await supabase.rpc('is_workspace_member', { target_workspace: workspaceId })
  if (memberError) return { supabase, user, workspaceId, error: NextResponse.json({ error: 'Workspace authorization could not be verified.' }, { status: 503 }) }
  if (!member) return { supabase, user, workspaceId, error: NextResponse.json({ error: 'You are not a member of this workspace.' }, { status: 403 }) }
  return { supabase, user, workspaceId, error: null }
}

export async function GET() {
  const context = await getContext()
  if (context.error) return context.error
  const { data: canEdit, error: roleError } = await context.supabase.rpc('is_workspace_admin', { target_workspace: context.workspaceId })
  if (roleError) return NextResponse.json({ error: 'Workspace authority could not be loaded.' }, { status: 503 })
  const { data: profiles, error } = await context.supabase
    .from('contractor_authority_profiles')
    .select('id,role_key,authority_level,capabilities,action_limits,prohibitions,active,updated_at')
    .eq('workspace_id', context.workspaceId)
    .order('role_key', { ascending: true })
  if (error) return NextResponse.json({ error: 'Could not load authority profiles.' }, { status: 502 })
  return NextResponse.json({ profiles: profiles ?? [], canEdit: canEdit === true })
}

export async function PUT(request: NextRequest) {
  const context = await getContext()
  if (context.error) return context.error
  const { data: canEdit, error: roleError } = await context.supabase.rpc('is_workspace_admin', { target_workspace: context.workspaceId })
  if (roleError || canEdit !== true) return NextResponse.json({ error: 'Workspace administrator access is required to edit authority profiles.' }, { status: 403 })
  const parsed = await readJson(request, 32 * 1024)
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: parsed.status })
  const body = parsed.body as Record<string, unknown>
  if (!Array.isArray(body.profiles) || body.profiles.length < 1 || body.profiles.length > 20) {
    return NextResponse.json({ error: 'profiles must contain 1–20 authority profiles.' }, { status: 400 })
  }

  const rows = []
  for (const value of body.profiles) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return NextResponse.json({ error: 'Each authority profile must be an object.' }, { status: 400 })
    const profile = value as Record<string, unknown>
    const roleKey = typeof profile.roleKey === 'string' ? profile.roleKey.trim() : ''
    const authorityLevel = typeof profile.authorityLevel === 'string' ? profile.authorityLevel.trim() : ''
    const capabilities = Array.isArray(profile.capabilities) ? profile.capabilities.filter((item): item is string => typeof item === 'string' && CAPABILITIES.has(item)).slice(0, 20) : []
    if (!ROLE_KEYS.has(roleKey) || !LEVELS.has(authorityLevel)) return NextResponse.json({ error: 'Each profile must use a supported roleKey and authorityLevel.' }, { status: 400 })
    rows.push({
      workspace_id: context.workspaceId,
      role_key: roleKey,
      authority_level: authorityLevel,
      capabilities,
      action_limits: profile.actionLimits && typeof profile.actionLimits === 'object' && !Array.isArray(profile.actionLimits) ? profile.actionLimits : {},
      prohibitions: Array.isArray(profile.prohibitions) ? profile.prohibitions.slice(0, 50) : [],
      active: profile.active !== false,
      created_by: context.user.id,
      updated_by: context.user.id,
    })
  }

  const { data, error } = await context.supabase
    .from('contractor_authority_profiles')
    .upsert(rows, { onConflict: 'workspace_id,role_key' })
    .select('id,role_key,authority_level,capabilities,action_limits,prohibitions,active,updated_at')
    .order('role_key', { ascending: true })
  if (error) return NextResponse.json({ error: 'Authority profiles could not be saved.' }, { status: error.code === '23505' ? 409 : 502 })
  return NextResponse.json({ profiles: data ?? [], canEdit: true })
}
