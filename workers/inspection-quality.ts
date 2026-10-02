import { SupabaseClient } from '@supabase/supabase-js'
import { createAgentRuntime } from './agent-runtime'

type InspectionQualityConfig = {
  supabaseUrl: string
  serviceRoleKey: string
  workerId: string
  workerVersion: string
}

type InspectionPhoto = {
  id: string
  object_path: string
  album: string
  caption: string | null
  upload_status: 'queued' | 'uploading' | 'uploaded' | 'failed'
  mime_type: string
  file_size_bytes: number | null
}

export async function runInspectionQuality(
  config: InspectionQualityConfig,
  workspaceId: string,
  inspectionId: string,
  reviewTaskCreatorId: string,
  eventKey: string,
) {
  const runtime = createAgentRuntime({
    ...config,
    reviewTaskCreatorId,
  })

  await runtime.heartbeat(workspaceId, 'inspection_quality', 'healthy', {
    deterministic: true,
    checks: ['photo_presence', 'upload_status', 'caption_presence', 'duplicate_object_path'],
  })

  return runtime.run(
    {
      workspaceId,
      agentKey: 'inspection_quality',
      eventKey,
      trigger: 'inspection_quality_scan',
      inputReference: { inspection_id: inspectionId },
    },
    async () => {
      const supabase = new SupabaseClient(config.supabaseUrl, config.serviceRoleKey)

      const { data: inspection, error: inspectionError } = await supabase
        .from('inspection_sessions')
        .select('id,workspace_id,created_by,status')
        .eq('id', inspectionId)
        .eq('workspace_id', workspaceId)
        .maybeSingle()

      if (inspectionError) throw inspectionError
      if (!inspection) throw new Error('Inspection was not found in the requested workspace.')
      if (inspection.status !== 'completed') {
        return {
          status: 'skipped' as const,
          output: { inspection_id: inspectionId, reason: 'inspection_not_completed' },
        }
      }

      const { data: photos, error: photosError } = await supabase
        .from('inspection_photos')
        .select('id,object_path,album,caption,upload_status,mime_type,file_size_bytes')
        .eq('inspection_id', inspectionId)
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: true })

      if (photosError) throw photosError

      const rows = (photos ?? []) as InspectionPhoto[]
      const issues: string[] = []
      if (rows.length === 0) issues.push('no_photos')

      const seenPaths = new Set<string>()
      const photoResults = rows.map((photo) => {
        const photoIssues: string[] = []
        if (photo.upload_status !== 'uploaded') photoIssues.push(`upload_status:${photo.upload_status}`)
        if (!photo.caption?.trim()) photoIssues.push('missing_caption')
        if (seenPaths.has(photo.object_path)) photoIssues.push('duplicate_object_path')
        seenPaths.add(photo.object_path)
        if (photoIssues.length) issues.push(`${photo.id}:${photoIssues.join(',')}`)
        return { id: photo.id, album: photo.album, issues: photoIssues }
      })

      const needsReview = issues.length > 0
      if (needsReview) {
        const { error: taskError } = await supabase.from('tasks').insert({
          workspace_id: workspaceId,
          title: 'Review inspection evidence quality',
          notes: `Inspection ${inspectionId} needs review: ${issues.join('; ')}`,
          assigned_to: reviewTaskCreatorId,
          created_by: reviewTaskCreatorId,
          status: 'open',
          automation_key: `inspection_quality:${inspectionId}:${eventKey}`,
        })
        if (taskError && taskError.code !== '23505') throw taskError
      }

      return {
        status: needsReview ? ('needs_review' as const) : ('succeeded' as const),
        output: {
          inspection_id: inspectionId,
          photo_count: rows.length,
          issue_count: issues.length,
          issues,
          photos: photoResults,
        },
        approvalState: needsReview ? ('pending' as const) : ('not_required' as const),
      }
    },
  )
}
