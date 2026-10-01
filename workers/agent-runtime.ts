import { createClient } from '@supabase/supabase-js'

type AgentKey = 'intake_router' | 'scheduler' | 'inspection_quality' | 'office_copilot'
type AgentStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'needs_review' | 'skipped'
type RuntimeConfig = { supabaseUrl: string; serviceRoleKey: string; workerId: string; workerVersion: string }
type AgentEvent = { workspaceId: string; agentKey: AgentKey; eventKey: string; trigger: string; inputReference: Record<string, unknown> }
type AgentResult = { status: Exclude<AgentStatus, 'queued' | 'running'>; output?: Record<string, unknown>; errorMessage?: string; approvalState?: 'not_required' | 'pending' | 'approved' | 'rejected' }

export function createAgentRuntime(config: RuntimeConfig) {
  const supabase = createClient(config.supabaseUrl, config.serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })

  async function heartbeat(workspaceId: string, agentKey: AgentKey, status: 'starting' | 'healthy' | 'degraded' | 'stopped', capabilities: Record<string, unknown> = {}) {
    const { error } = await supabase.from('agent_worker_heartbeats').upsert({ workspace_id: workspaceId, agent_key: agentKey, worker_id: config.workerId, worker_version: config.workerVersion, status, capabilities, last_seen_at: new Date().toISOString() })
    if (error) throw error
  }

  async function run(event: AgentEvent, handler: () => Promise<AgentResult>) {
    const { data: started, error: claimError } = await supabase.rpc('claim_agent_run', { p_workspace_id: event.workspaceId, p_agent_key: event.agentKey, p_event_key: event.eventKey, p_trigger: event.trigger, p_input_reference: event.inputReference, p_worker_id: config.workerId, p_lease_seconds: 300 })
    if (claimError) throw claimError
    if (!started) {
      const { data: existing, error } = await supabase.from('agent_runs').select('id,status,output').match({ workspace_id: event.workspaceId, agent_key: event.agentKey, event_key: event.eventKey }).maybeSingle()
      if (error) throw error
      return existing
    }
    try {
      const result = await handler()
      const { data, error } = await supabase.from('agent_runs').update({ status: result.status, output: result.output ?? {}, error_message: result.errorMessage ?? null, approval_state: result.approvalState ?? 'not_required', finished_at: new Date().toISOString(), lease_owner: null, lease_expires_at: null }).eq('id', started.id).eq('lease_owner', config.workerId).select().single()
      if (error) throw error
      return data
    } catch (error) {
      await supabase.from('agent_runs').update({ status: 'failed', error_message: error instanceof Error ? error.message : 'Unknown worker error', finished_at: new Date().toISOString(), lease_owner: null, lease_expires_at: null }).eq('id', started.id).eq('lease_owner', config.workerId)
      throw error
    }
  }

  return { heartbeat, run }
}
