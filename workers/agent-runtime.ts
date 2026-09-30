import { createClient, SupabaseClient } from '@supabase/supabase-js'

type AgentKey = 'intake_router' | 'scheduler' | 'inspection_quality' | 'office_copilot'
type AgentStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'needs_review' | 'skipped'

type RuntimeConfig = { supabaseUrl: string; serviceRoleKey: string; workerId: string; workerVersion: string }
type AgentEvent = { workspaceId: string; agentKey: AgentKey; eventKey: string; trigger: string; inputReference: Record<string, unknown> }

export function createAgentRuntime(config: RuntimeConfig) {
  const supabase = createClient(config.supabaseUrl, config.serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })

  async function heartbeat(workspaceId: string, agentKey: AgentKey, status: 'starting' | 'healthy' | 'degraded' | 'stopped', capabilities: Record<string, unknown> = {}) {
    const { error } = await supabase.from('agent_worker_heartbeats').upsert({
      workspace_id: workspaceId, agent_key: agentKey, worker_id: config.workerId,
      worker_version: config.workerVersion, status, capabilities, last_seen_at: new Date().toISOString(),
    })
    if (error) throw error
  }

  async function run(event: AgentEvent, handler: () => Promise<{ status: Exclude<AgentStatus, 'queued' | 'running'>; output?: Record<string, unknown>; errorMessage?: string; approvalState?: 'not_required' | 'pending' | 'approved' | 'rejected' }>) {
    const { data: workspace, error: workspaceError } = await supabase
      .from('workspaces')
      .select('id')
      .eq('id', event.workspaceId)
      .maybeSingle()
    if (workspaceError) throw workspaceError
    if (!workspace) throw new Error(`Unknown workspace: ${event.workspaceId}`)
    const base = { workspace_id: event.workspaceId, agent_key: event.agentKey, event_key: event.eventKey, trigger: event.trigger, input_reference: event.inputReference }
    const { data: existing } = await supabase.from('agent_runs').select('id,status,output').match({ workspace_id: event.workspaceId, agent_key: event.agentKey, event_key: event.eventKey }).maybeSingle()
    if (existing?.status === 'succeeded' || existing?.status === 'needs_review') return existing
    if (existing?.status === 'running') return existing

    let started: { id: string } | null = null
    if (existing) {
      const { data, error } = await supabase.from('agent_runs').update({ status: 'running', started_at: new Date().toISOString(), attempt: 2 }).eq('id', existing.id).eq('status', existing.status).select('id').maybeSingle()
      if (error) throw error
      started = data
    } else {
      const { data, error } = await supabase.from('agent_runs').insert({ ...base, status: 'running', started_at: new Date().toISOString(), attempt: 1 }).select('id').maybeSingle()
      if (error && error.code !== '23505') throw error
      if (!data) {
        const { data: claimed } = await supabase.from('agent_runs').select('id,status,output').match({ workspace_id: event.workspaceId, agent_key: event.agentKey, event_key: event.eventKey }).maybeSingle()
        return claimed
      }
      started = data
    }
    if (!started) return existing

    try {
      const result = await handler()
      const { data, error } = await supabase.from('agent_runs').update({ status: result.status, output: result.output ?? {}, error_message: result.errorMessage ?? null, approval_state: result.approvalState ?? 'not_required', finished_at: new Date().toISOString() }).eq('id', started.id).select().single()
      if (error) throw error
      return data
    } catch (error) {
      await supabase.from('agent_runs').update({ status: 'failed', error_message: error instanceof Error ? error.message : 'Unknown worker error', finished_at: new Date().toISOString() }).eq('id', started.id)
      throw error
    }
  }

  return { heartbeat, run }
}
