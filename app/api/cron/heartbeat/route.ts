import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '../../../../lib/supabase/admin'
import { AGENT_KEYS, evaluateAgentReadiness, getAgentRegistration } from '../../../../workers/agent-registry'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim()
  const supplied = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!secret || supplied !== secret) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  const admin = createAdminClient()
  const { data: workspaces, error } = await admin
    .from('workspaces')
    .select('id')
    .order('created_at', { ascending: true })
    .limit(100)
  if (error) return NextResponse.json({ error: 'Could not read staging workspaces.', detail: error.message }, { status: 502 })

  const workspaceIds = (workspaces ?? []).map((workspace) => workspace.id)
  const { data: heartbeats, error: heartbeatError } = workspaceIds.length
    ? await admin
      .from('agent_worker_heartbeats')
      .select('workspace_id,agent_key,status,last_seen_at,worker_id,worker_version')
      .in('workspace_id', workspaceIds)
    : { data: [], error: null }
  if (heartbeatError) return NextResponse.json({ error: 'Could not read worker heartbeats.', detail: heartbeatError.message }, { status: 502 })

  const now = new Date()
  const agents = AGENT_KEYS.map((agentKey) => {
    const registration = getAgentRegistration(agentKey)
    const rows = (heartbeats ?? []).filter((row) => row.agent_key === agentKey)
    const workspaceResults = workspaceIds.map((workspaceId) => {
      const heartbeat = rows.find((row) => row.workspace_id === workspaceId) ?? null
      return { workspaceId, ...evaluateAgentReadiness(registration, heartbeat, now) }
    })
    return {
      agentKey,
      label: registration.label,
      registered: registration.implemented,
      entryPoint: registration.entryPoint,
      healthyWorkspaces: workspaceResults.filter((result) => result.ready).length,
      notReadyWorkspaces: workspaceResults.filter((result) => !result.ready).length,
      workspaces: workspaceResults,
    }
  })
  const notReady = agents.filter((agent) => agent.notReadyWorkspaces > 0).map((agent) => agent.agentKey)
  return NextResponse.json({
    status: notReady.length ? 'not_ready' : 'healthy',
    heartbeatOnly: true,
    workspaceCount: workspaceIds.length,
    agents,
    ready: notReady.length === 0 && workspaceIds.length > 0,
    notReady,
    boundary: 'heartbeat-only',
  }, { status: notReady.length ? 503 : 200 })
}

// Vercel Cron invokes scheduled paths with GET; keep POST for manual runs.
export const GET = POST
