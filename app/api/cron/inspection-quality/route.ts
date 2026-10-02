import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '../../../../lib/supabase/admin'
import { runInspectionQuality } from '../../../../workers/inspection-quality'

export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim()
  const supplied = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!secret || supplied !== secret) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: 'Supabase worker configuration is incomplete.' }, { status: 503 })
  }

  const admin = createAdminClient()
  const { data: inspections, error } = await admin
    .from('inspection_sessions')
    .select('id,workspace_id,created_by,updated_at')
    .eq('status', 'completed')
    .order('updated_at', { ascending: true })
    .limit(25)

  if (error) return NextResponse.json({ error: 'Could not read completed inspections.', detail: error.message }, { status: 502 })

  let processed = 0
  let failed = 0
  const failures: Array<{ inspectionId: string; error: string }> = []

  for (const inspection of inspections ?? []) {
    try {
      const { data: latestPhoto } = await admin
        .from('inspection_photos')
        .select('updated_at')
        .eq('inspection_id', inspection.id)
        .eq('workspace_id', inspection.workspace_id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      const eventKey = `inspection-quality:${inspection.id}:${latestPhoto?.updated_at ?? inspection.updated_at}`
      await runInspectionQuality(
        { supabaseUrl, serviceRoleKey, workerId: process.env.AGENT_WORKER_ID?.trim() || 'vercel-cron', workerVersion: process.env.AGENT_WORKER_VERSION?.trim() || 'inspection-quality-v1' },
        inspection.workspace_id,
        inspection.id,
        inspection.created_by,
        eventKey,
      )
      processed += 1
    } catch (error) {
      failed += 1
      failures.push({
        inspectionId: inspection.id,
        error: error instanceof Error ? error.message : 'Unknown inspection-quality worker error',
      })
    }
  }

  if (failed > 0) {
    return NextResponse.json({ processed, failed, failures }, { status: 500 })
  }

  return NextResponse.json({ processed, failed: 0 })
}
