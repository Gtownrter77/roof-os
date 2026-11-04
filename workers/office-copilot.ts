import type { SupabaseClient } from '@supabase/supabase-js'

export type OfficePhoto = {
  id: string
  album: string
  caption?: string | null
  uploadStatus: 'queued' | 'uploading' | 'uploaded' | 'failed'
  objectPath: string
}

export type OfficeActivity = {
  kind: string
  label: string
  createdAt: string
}

export type OfficeCopilotInput = {
  inspectionId: string
  leadName: string
  photos: OfficePhoto[]
  activity: OfficeActivity[]
}

export type OfficeCopilotDraft = {
  inspectionId: string
  leadName: string
  authority: 'draft_for_human_review'
  approvalState: 'pending'
  missingAlbums: string[]
  deficiencies: string[]
  activityCount: number
  summary: string
  evidence: Array<Record<string, unknown>>
}

type OfficeCopilotConfig = {
  supabaseUrl: string
  serviceRoleKey: string
  workerId: string
  workerVersion: string
}

const REQUIRED_ALBUMS = ['before', 'damage', 'measurements']

export function buildOfficeCopilotDraft(input: OfficeCopilotInput): OfficeCopilotDraft {
  const albumSet = new Set(input.photos.map((photo) => photo.album))
  const missingAlbums = REQUIRED_ALBUMS.filter((album) => !albumSet.has(album))
  const deficiencies: string[] = []
  const seenPaths = new Set<string>()
  for (const photo of input.photos) {
    const photoIssues: string[] = []
    if (photo.uploadStatus !== 'uploaded') photoIssues.push(`upload_status:${photo.uploadStatus}`)
    if (!photo.caption?.trim()) photoIssues.push('missing_caption')
    if (seenPaths.has(photo.objectPath)) photoIssues.push('duplicate_object_path')
    seenPaths.add(photo.objectPath)
    for (const issue of photoIssues) deficiencies.push(`${photo.id}:${issue}`)
  }
  for (const album of missingAlbums) deficiencies.push(`missing_album:${album}`)

  const summary = deficiencies.length === 0
    ? `Draft inspection summary for ${input.leadName}: ${input.photos.length} evidence photos and ${input.activity.length} activity events are ready for human review.`
    : `Draft inspection summary for ${input.leadName}: ${deficiencies.length} evidence issue(s) require review before a report can be approved.`

  return {
    inspectionId: input.inspectionId,
    leadName: input.leadName,
    authority: 'draft_for_human_review',
    approvalState: 'pending',
    missingAlbums,
    deficiencies,
    activityCount: input.activity.length,
    summary,
    evidence: [{
      inspectionId: input.inspectionId,
      photoCount: input.photos.length,
      activityCount: input.activity.length,
      deficiencies,
    }],
  }
}

export async function runOfficeCopilot(
  config: OfficeCopilotConfig,
  workspaceId: string,
  inspectionId: string,
  reviewTaskCreatorId: string,
  eventKey: string,
) {
  const { createClient } = await import('@supabase/supabase-js')
  const { persistActionBatch } = await import('./action-batch')
  const { createAgentRuntime } = await import('./agent-runtime')
  const { runLlamaAgentJson } = await import('./llama-agent')
  const runtime = createAgentRuntime({ ...config, reviewTaskCreatorId })
  await runtime.heartbeat(workspaceId, 'office_copilot', 'healthy', {
    deterministic: true,
    llama_advisory: process.env.LLAMA_AGENT_ENABLED?.trim().toLowerCase() === 'true',
    checks: ['photo_albums', 'upload_status', 'caption_presence', 'duplicate_object_path', 'activity_summary'],
  })

  return runtime.run({
    workspaceId,
    agentKey: 'office_copilot',
    eventKey,
    trigger: 'office_report_draft',
    inputReference: { inspection_id: inspectionId },
  }, async () => {
    const supabase = createClient(config.supabaseUrl, config.serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
    const planned = await planOfficeCopilotForInspection(supabase, workspaceId, inspectionId, reviewTaskCreatorId)
    if ('reason' in planned) return { status: 'skipped' as const, output: { inspection_id: inspectionId, reason: planned.reason } }
    const { draft, leadName, actions } = planned
    const llamaAdvisory = await runLlamaAgentJson<{ summary?: string; suggested_review_items?: string[] }>({
      agentKey: 'office_copilot',
      promptVersion: 'office-copilot-draft-v1',
      instruction: 'Summarize only the supplied inspection evidence. Do not infer damage, measurements, coverage, pricing, approval, or customer communication.',
      input: draft,
    })
    const batchKey = officeCopilotBatchKey(inspectionId, eventKey)
    const { data: existingBatch, error: existingBatchError } = await supabase
      .from('agent_action_batches')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('batch_key', batchKey)
      .maybeSingle()
    if (existingBatchError) throw existingBatchError
    const actionBatch = existingBatch
      ? { batch: existingBatch }
      : await persistActionBatch(supabase, {
          workspaceId,
          batchKey,
          summary: officeCopilotBatchSummary(leadName),
          actions,
        })
    return {
      status: 'needs_review' as const,
      output: { ...draft, model_assistance: llamaAdvisory ?? { enabled: false }, action_batch_id: actionBatch.batch.id },
      approvalState: 'pending' as const,
    }
  })
}

export function officeCopilotBatchKey(inspectionId: string, eventKey: string): string {
  return `office-copilot-review:${inspectionId}:${eventKey}`
}

export function officeCopilotBatchSummary(leadName: string): string {
  return `Review draft inspection report for ${leadName}`
}

export function buildOfficeCopilotActions(draft: OfficeCopilotDraft, leadName: string, inspectionId: string, reviewTaskCreatorId: string) {
  return [{
    kind: 'create_review_task' as const,
    subjectType: 'inspection' as const,
    subjectId: inspectionId,
    payload: {
      createdByUserId: reviewTaskCreatorId,
      assignedToUserId: reviewTaskCreatorId,
      title: `Review draft inspection report: ${leadName}`,
      notes: `${draft.summary} Human approval is required before report delivery.`,
    },
    reason: 'Office Copilot drafts are advisory and require human review.',
    sourceEvidence: draft.evidence,
    idempotencyKey: `office-copilot-review:${inspectionId}`,
  }]
}

/**
 * Read-only planning step shared by the live run and the cron dry-run mode.
 * Performs workspace-scoped reads only; never writes and never calls a model.
 */
export async function planOfficeCopilotForInspection(
  supabase: SupabaseClient,
  workspaceId: string,
  inspectionId: string,
  reviewTaskCreatorId: string,
): Promise<
  | { skipped: true; reason: 'inspection_not_completed' }
  | { skipped: false; draft: OfficeCopilotDraft; leadName: string; actions: ReturnType<typeof buildOfficeCopilotActions> }
> {
  const { data: inspection, error: inspectionError } = await supabase
    .from('inspection_sessions')
    .select('id,workspace_id,lead_id,status')
    .eq('id', inspectionId)
    .eq('workspace_id', workspaceId)
    .maybeSingle()
  if (inspectionError) throw inspectionError
  if (!inspection) throw new Error('Inspection was not found in the requested workspace.')
  if (inspection.status !== 'completed') return { skipped: true, reason: 'inspection_not_completed' }

  const { data: photos, error: photosError } = await supabase
    .from('inspection_photos')
    .select('id,album,caption,upload_status,object_path')
    .eq('inspection_id', inspectionId)
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: true })
  if (photosError) throw photosError

  let leadName = 'the customer'
  if (inspection.lead_id) {
    const { data: lead, error: leadError } = await supabase.from('leads').select('name').eq('id', inspection.lead_id).eq('workspace_id', workspaceId).maybeSingle()
    if (leadError) throw leadError
    if (lead?.name) leadName = lead.name
  }

  const { data: activity, error: activityError } = inspection.lead_id
    ? await supabase
        .from('lead_activity')
        .select('kind,body,created_at')
        .eq('lead_id', inspection.lead_id)
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })
        .limit(50)
    : { data: [], error: null }
  if (activityError) throw activityError

  const draft = buildOfficeCopilotDraft({
    inspectionId,
    leadName,
    photos: (photos ?? []).map((photo) => ({
      id: photo.id,
      album: photo.album,
      caption: photo.caption,
      uploadStatus: photo.upload_status,
      objectPath: photo.object_path,
    })),
    activity: (activity ?? []).map((item) => ({ kind: item.kind, label: item.body, createdAt: item.created_at })),
  })
  return { skipped: false, draft, leadName, actions: buildOfficeCopilotActions(draft, leadName, inspectionId, reviewTaskCreatorId) }
}
