import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '../../../../lib/supabase/admin'
import { writeWorkerHeartbeats } from '../../../../workers/heartbeat'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim()
  const supplied = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!secret || supplied !== secret) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  const admin = createAdminClient()
  const { data: workspaces, error } = await admin.from('workspaces').select('id').order('created_at', { ascending: true }).limit(100)
  if (error) return NextResponse.json({ error: 'Could not read staging workspaces.', detail: error.message }, { status: 502 })
  const result = await writeWorkerHeartbeats(admin, (workspaces ?? []).map((workspace) => workspace.id), 'scheduler', 'healthy', { probe: 'staging-heartbeat' })
  if (result.errors) return NextResponse.json({ error: 'Heartbeat persistence failed.', persisted: result.persisted }, { status: 502 })
  return NextResponse.json({ status: 'healthy', persisted: result.persisted, boundary: 'heartbeat-only' })
}
