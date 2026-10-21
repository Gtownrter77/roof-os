import { NextResponse } from 'next/server'
import { createClient } from '../../../lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  const { data: workspaceId, error: workspaceError } = await supabase.rpc('current_workspace_id')
  if (workspaceError || !workspaceId) return NextResponse.json({ error: 'No workspace is configured.' }, { status: 400 })

  const { data: batches, error: batchError } = await supabase
    .from('agent_action_batches')
    .select('id,batch_key,status,risk_level,summary,expires_at,created_at')
    .eq('workspace_id', workspaceId)
    .in('status', ['proposed', 'awaiting_approval'])
    .order('created_at', { ascending: false })
    .limit(50)
  if (batchError) return NextResponse.json({ error: 'Could not load agent action batches.', detail: batchError.message }, { status: 502 })

  const batchIds = (batches ?? []).map((batch) => batch.id)
  if (!batchIds.length) return NextResponse.json({ batches: [] })
  const { data: actions, error: actionError } = await supabase
    .from('agent_actions')
    .select('id,batch_id,sequence,kind,subject_type,subject_id,payload,reason,source_evidence,risk_level,status,idempotency_key,requires_approval,payload_hash')
    .eq('workspace_id', workspaceId)
    .in('batch_id', batchIds)
    .order('sequence', { ascending: true })
  if (actionError) return NextResponse.json({ error: 'Could not load proposed agent actions.', detail: actionError.message }, { status: 502 })

  return NextResponse.json({
    batches: (batches ?? []).map((batch) => ({
      ...batch,
      actions: (actions ?? []).filter((action) => action.batch_id === batch.id),
    })),
  })
}
