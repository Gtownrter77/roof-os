import { NextRequest, NextResponse } from 'next/server'
import { isUuid, readJson, requireWorkspaceMember } from '../../../../../../lib/api-security'
import { createClient } from '../../../../../../lib/supabase/server'
import { disableDecision } from '../../../../../../lib/jarvis/api/index'

/** Stop control for a single claim: disables enrollment and cancels queued work. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: 'A valid claim id is required.' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  const { data: workspaceId } = await supabase.rpc('current_workspace_id')
  if (!isUuid(workspaceId)) return NextResponse.json({ error: 'Workspace could not be verified.' }, { status: 403 })
  const membership = await requireWorkspaceMember(supabase, user.id, workspaceId)
  if (membership.response) return membership.response

  const { data: claim } = await supabase
    .from('adjuster_claims')
    .select('id')
    .eq('id', id)
    .eq('workspace_id', workspaceId)
    .maybeSingle()
  if (!claim) return NextResponse.json({ error: 'Claim not found in this workspace.' }, { status: 404 })

  const parsed = await readJson(request, 8 * 1024)
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: parsed.status })
  const body = (parsed.body as Record<string, unknown>) ?? {}
  const disabled = body.disabled === undefined ? true : body.disabled === true
  const decision = disableDecision({ kind: 'claim', claimId: id, workspaceId })
  const args = disabled ? decision.args : { ...decision.args, p_disabled: false }
  const { error } = await supabase.rpc(decision.function, args)
  if (error) return NextResponse.json({ error: 'Disable control could not be applied.' }, { status: 502 })
  return NextResponse.json({ claimId: id, disabled })
}
