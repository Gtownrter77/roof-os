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
    const base = { workspace_id: event.workspaceId, agent_key: event.agentKey, event_key: event.eventKey, trigger: event.trigger, input_reference: event.inputReference }
    const { data: existing } = await supabase.from('agent_runs').select('id,status,output').match({ workspace_id: event.workspaceId, agent_key: event.agentKey, event_key: event.eventKey }).maybeSingle()
    if (existing?.status === 'succeeded' || existing?.status === 'needs_review') return existing

    const { data: started, error: startError } = await supabase.from('agent_runs').upsert({ ...base, status: 'running', started_at: new Date().toISOString(), attempt: existing ? 2 : 1 }, { onConflict: 'workspace_id,agent_key,event_key' }).select('id').single()
    if (startError) throw startError

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
