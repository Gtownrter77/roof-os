import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'
import { readJson } from '../../../../lib/api-security'
import {
  BAILEY_AGENT_SETUP_VERSION,
  defaultBaileyAgentSetup,
  validateBaileyAgentSetup,
  type BaileyAgentSetupStatus,
} from '../../../../lib/bailey-agent-onboarding'

async function context() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, user: null, workspaceId: null, workspaceError: null }
  const { data: workspaceId, error: workspaceError } = await supabase.rpc('current_workspace_id')
  return { supabase, user, workspaceId, workspaceError }
}

export async function GET() {
  const { supabase, user, workspaceId, workspaceError } = await context()
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  if (workspaceError) return NextResponse.json({ error: 'Active workspace could not be verified.' }, { status: 503 })
  if (!workspaceId) return NextResponse.json({ error: 'No active workspace is available.' }, { status: 404 })

  const { data: isAdmin, error: roleError } = await supabase.rpc('is_workspace_admin', { target_workspace: workspaceId })
  if (roleError) return NextResponse.json({ error: 'Workspace authorization could not be verified.' }, { status: 503 })

  const { data, error } = await supabase.from('workspace_bailey_agent_setup')
    .select('setup,status,schema_version,updated_at,reviewed_at')
    .eq('workspace_id', workspaceId).maybeSingle()
  if (error) return NextResponse.json({ error: 'BAILEY agent setup is unavailable. Check database migration 094.' }, { status: 502 })

  const validated = data ? validateBaileyAgentSetup(data.setup) : null
  if (data && !validated?.setup) return NextResponse.json({ error: 'Saved agent setup failed validation.' }, { status: 502 })

  return NextResponse.json({
    setup: validated?.setup ?? defaultBaileyAgentSetup(),
    status: data?.status ?? 'draft',
    schemaVersion: data?.schema_version ?? BAILEY_AGENT_SETUP_VERSION,
    updatedAt: data?.updated_at ?? null,
    reviewedAt: data?.reviewed_at ?? null,
    canEdit: isAdmin === true,
    operational: false,
  })
}

export async function PUT(request: NextRequest) {
  const { supabase, user, workspaceId, workspaceError } = await context()
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  if (workspaceError) return NextResponse.json({ error: 'Active workspace could not be verified.' }, { status: 503 })
  if (!workspaceId) return NextResponse.json({ error: 'No active workspace is available.' }, { status: 404 })

  const { data: isAdmin, error: roleError } = await supabase.rpc('is_workspace_admin', { target_workspace: workspaceId })
  if (roleError) return NextResponse.json({ error: 'Workspace authorization could not be verified.' }, { status: 503 })
  if (isAdmin !== true) return NextResponse.json({ error: 'Workspace administrator access is required.' }, { status: 403 })

  const parsed = await readJson(request)
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: parsed.status })
  const body = parsed.body
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'Request body must be an object.' }, { status: 400 })
  }
  const fields = body as Record<string, unknown>
  if (Object.keys(fields).some((key) => !['setup', 'status'].includes(key))) {
    return NextResponse.json({ error: 'Request contains an unsupported field.' }, { status: 400 })
  }
  const validated = validateBaileyAgentSetup(fields.setup)
  if (!validated.setup) return NextResponse.json({ error: validated.error }, { status: 400 })
  const status = fields.status ?? 'draft'
  if (status !== 'draft' && status !== 'reviewed') {
    return NextResponse.json({ error: 'Status must be draft or reviewed.' }, { status: 400 })
  }

  const now = new Date().toISOString()
  const { data, error } = await supabase.from('workspace_bailey_agent_setup').upsert({
    workspace_id: workspaceId,
    setup: validated.setup,
    status: status as BaileyAgentSetupStatus,
    schema_version: BAILEY_AGENT_SETUP_VERSION,
    updated_by: user.id,
    updated_at: now,
    reviewed_at: status === 'reviewed' ? now : null,
  }, { onConflict: 'workspace_id' }).select('setup,status,schema_version,updated_at,reviewed_at').single()

  if (error) return NextResponse.json({ error: 'Could not save BAILEY agent setup.' }, { status: 502 })
  return NextResponse.json({ saved: true, ...data, operational: false })
}
