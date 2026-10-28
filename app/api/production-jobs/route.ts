import { NextResponse } from 'next/server'
import { createClient } from '../../../lib/supabase/server'
import { requireWorkspaceMember } from '../../../lib/api-security'

/**
 * Production job list. Workspace-scoped and member-readable.
 *
 * The handoff snapshot is created elsewhere (migration 064). This route only
 * lists jobs and never recomputes the customer, amount, or scope.
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })

  const { data: workspaceId } = await supabase.rpc('current_workspace_id')
  if (!workspaceId) return NextResponse.json({ error: 'No workspace is configured.' }, { status: 400 })

  const membership = await requireWorkspaceMember(supabase, user.id, workspaceId)
  if ('response' in membership) return membership.response

  const { data, error } = await supabase
    .from('production_jobs')
    .select('id,job_number,customer_name,property_address,status,accepted_total,accepted_at,scope_item_count,created_at')
    .eq('workspace_id', workspaceId)
    .order('accepted_at', { ascending: false })
    .limit(100)

  if (error) return NextResponse.json({ error: 'Could not load production jobs.' }, { status: 502 })

  return NextResponse.json({
    jobs: data ?? [],
    note: 'Production jobs keep the customer, amount, and scope that were true at acceptance.',
  })
}
