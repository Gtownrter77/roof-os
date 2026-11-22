import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { isStaleRunning } from '../lib/agent-runtime-recovery'

type AgentKey = 'intake_router' | 'scheduler' | 'inspection_quality' | 'office_copilot'
type AgentStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'needs_review' | 'skipped'

type RuntimeConfig = { supabaseUrl: string; serviceRoleKey: string; workerId: string; workerVersion: string; reviewTaskCreatorId?: string }
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
    const { data: existing } = await supabase.from('agent_runs').select('id,status,output,attempt,started_at').match({ workspace_id: event.workspaceId, agent_key: event.agentKey, event_key: event.eventKey }).maybeSingle()
    if (existing?.status === 'succeeded' || existing?.status === 'needs_review') return existing
    // A live run is an idempotency guard; an orphaned run must not wedge the
    // event key forever. Re-claim only inside the bounded staleness window.
    if (existing?.status === 'running' && !isStaleRunning(existing.started_at, Date.now())) return existing
    const now = new Date().toISOString()

    let started: { id: string } | null = null
    if (existing) {
      let claim = supabase
        .from('agent_runs')
        .update({ status: 'running', started_at: now, attempt: (existing.attempt ?? 1) + 1 })
        .eq('id', existing.id)
      if (existing.status === 'running') {
        // Optimistic re-claim: if a competing reclaimer changed the start
        // token between our SELECT and UPDATE, its claim wins and our UPDATE
        // affects no rows (line 63 returns the existing row). Never steal a
        // run we did not observe.
        claim = claim.eq('status', 'running')
        claim = existing.started_at ? claim.eq('started_at', existing.started_at) : claim.is('started_at', null)
      } else {
        claim = claim.eq('status', existing.status)
      }
      const { data, error } = await claim.select('id').maybeSingle()
      if (error) throw error
      started = data
    } else {
      const { data, error } = await supabase.from('agent_runs').insert({ ...base, status: 'running', started_at: now, attempt: 1 }).select('id').maybeSingle()
      if (error && error.code !== '23505') throw error
      if (!data) {
        const { data: claimed } = await supabase.from('agent_runs').select('id,status,output,attempt,started_at').match({ workspace_id: event.workspaceId, agent_key: event.agentKey, event_key: event.eventKey }).maybeSingle()
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
      const errorMessage = error instanceof Error ? error.message : 'Unknown worker error'
      const { data: failedRows, error: failureWriteError } = await supabase
        .from('agent_runs')
        .update({ status: 'failed', error_message: errorMessage, finished_at: new Date().toISOString() })
        .eq('id', started.id)
        .select('id')
      if (failureWriteError || !failedRows?.length) {
        throw new Error(`Agent run ${started.id} could not be recorded as failed after ${errorMessage}: ${failureWriteError?.message ?? 'no rows affected'}`)
      }
      if (config.reviewTaskCreatorId) {
        const leadId = typeof event.inputReference.lead_id === 'string' ? event.inputReference.lead_id : null
        const { error: taskError } = await supabase.from('tasks').insert({ workspace_id: event.workspaceId, lead_id: leadId, title: `Review failed ${event.agentKey} run`, notes: `${errorMessage} (event ${event.eventKey})`, assigned_to: config.reviewTaskCreatorId, created_by: config.reviewTaskCreatorId, status: 'open' })
        if (taskError) throw new Error(`Review task for failed ${event.agentKey} run could not be created: ${taskError.message}`)
      }
      throw error
    }
  }

  return { heartbeat, run }
}
