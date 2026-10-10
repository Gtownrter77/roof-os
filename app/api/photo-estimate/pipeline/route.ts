import { NextRequest, NextResponse } from 'next/server'
import { isUuid, readJson } from '../../../../lib/api-security'
import { createClient } from '../../../../lib/supabase/server'

/**
 * This legacy pipeline currently returns hard-coded demo addresses, dimensions,
 * pricing, storm history, and customer-dispatch defaults. It must remain closed
 * until those operations are backed by authorized, persisted production workflows.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  }

  const { data: workspaceId, error: workspaceError } = await supabase.rpc('current_workspace_id')
  if (workspaceError) {
    return NextResponse.json({ error: 'Workspace authorization could not be verified.' }, { status: 503 })
  }
  if (!isUuid(workspaceId)) {
    return NextResponse.json({ error: 'An active workspace is required.' }, { status: 403 })
  }

  const { data: isAdmin, error: roleError } = await supabase.rpc('is_workspace_admin', {
    target_workspace: workspaceId,
  })
  if (roleError) {
    return NextResponse.json({ error: 'Workspace authorization could not be verified.' }, { status: 503 })
  }
  if (!isAdmin) {
    return NextResponse.json({ error: 'Workspace administrator access is required.' }, { status: 403 })
  }

  const parsed = await readJson(request, 8 * 1024)
  if ('error' in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: parsed.status })
  }

  return NextResponse.json({
    error: 'The legacy photo pipeline is disabled because its results use hard-coded demo data and are not production-verified.',
    code: 'PHOTO_PIPELINE_PROTOTYPE_DISABLED',
    message: 'Use the persisted photo-estimate workflow. This endpoint will remain unavailable until real provider integrations, persistence, and review authorization are implemented.',
  }, { status: 503 })
}
