import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '../../../../lib/supabase/admin'
import { executeApprovedBatch } from '../../../../workers/action-executor'

export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim()
  const supplied = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!secret || supplied !== secret) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  const admin = createAdminClient()
  const { data: batches, error } = await admin
    .from('agent_action_batches')
    .select('id')
    .eq('status', 'approved')
    .order('created_at', { ascending: true })
    .limit(25)
  if (error) return NextResponse.json({ error: 'Could not read approved action batches.', detail: error.message }, { status: 502 })

  let executed = 0
  let failed = 0
  let skipped = 0
  const failures: Array<{ batchId: string; error: string }> = []
  for (const batch of batches ?? []) {
    try {
      const result = await executeApprovedBatch(admin, batch.id)
      executed += result.executed
      failed += result.failed
      skipped += result.skipped
    } catch (workerError) {
      failed += 1
      failures.push({ batchId: batch.id, error: workerError instanceof Error ? workerError.message : 'Unknown action executor error' })
    }
  }
  return NextResponse.json({ processed: batches?.length ?? 0, executed, failed, skipped, failures }, { status: failures.length ? 502 : 200 })
}
