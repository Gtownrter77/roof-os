import { NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'
import { defaultBaileyAgentSetup, validateBaileyAgentSetup, type BaileyAgentSetupStatus } from '../../../../lib/bailey-agent-onboarding'
import { describeBaileyAgentReadiness, EXISTING_LEGACY_WORKER_KEYS } from '../../../../lib/bailey-agent-readiness'
import type { AgentKey, HeartbeatRecord } from '../../../../workers/agent-registry'

export const dynamic = 'force-dynamic'

// Workspace-admin read-only evidence view. It neither invokes workers nor changes agent settings.
export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })

  const { data: workspaceId, error: workspaceError } = await supabase.rpc('current_workspace_id')
  if (workspaceError) return NextResponse.json({ error: 'Active workspace could not be verified.' }, { status: 503 })
  if (!workspaceId) return NextResponse.json({ error: 'No active workspace is available.' }, { status: 404 })

  const { data: isAdmin, error: roleError } = await supabase.rpc('is_workspace_admin', { target_workspace: workspaceId })
  if (roleError) return NextResponse.json({ error: 'Workspace authorization could not be verified.' }, { status: 503 })
  if (isAdmin !== true) return NextResponse.json({ error: 'Workspace administrator access is required.' }, { status: 403 })

  const { data: stored, error: setupError } = await supabase.from('workspace_bailey_agent_setup')
    .select('setup,status').eq('workspace_id', workspaceId).maybeSingle()
  if (setupError) return NextResponse.json({ error: 'Agent preferences could not be loaded.' }, { status: 502 })

  const validated = stored ? validateBaileyAgentSetup(stored.setup) : null
  if (stored && !validated?.setup) return NextResponse.json({ error: 'Agent preferences failed validation.' }, { status: 502 })
  const setup = validated?.setup ?? defaultBaileyAgentSetup()
  const status: BaileyAgentSetupStatus = stored?.status === 'reviewed' ? 'reviewed' : 'draft'

  const { data: rows, error: heartbeatError } = await supabase.from('agent_worker_heartbeats')
    .select('agent_key,status,last_seen_at')
    .eq('workspace_id', workspaceId)
    .in('agent_key', [...EXISTING_LEGACY_WORKER_KEYS])
  if (heartbeatError) return NextResponse.json({ error: 'Worker evidence could not be loaded.' }, { status: 502 })

  const heartbeats: Partial<Record<AgentKey, HeartbeatRecord>> = {}
  for (const row of rows ?? []) {
    if (EXISTING_LEGACY_WORKER_KEYS.some((key) => key === row.agent_key)) {
      heartbeats[row.agent_key as AgentKey] = { status: row.status, last_seen_at: row.last_seen_at }
    }
  }

  return NextResponse.json({
    agents: describeBaileyAgentReadiness(setup, status, heartbeats),
    legacyWorkerCount: EXISTING_LEGACY_WORKER_KEYS.length,
    operationalAgentCount: 0,
    executionAuthorized: false,
    heartbeatOnly: true,
    explanation: 'Legacy worker heartbeat evidence is not proof that a BAILEY agent is implemented or authorized. Onboarding preferences never activate agents.',
  }, { headers: { 'Cache-Control': 'no-store' } })
}
