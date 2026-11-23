import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '../../../../lib/supabase/admin'
import { createClient } from '../../../../lib/supabase/server'
import { isUuid, readJson } from '../../../../lib/api-security'
import { assertWorkspaceMatch } from '../../../../lib/hover/util.ts'
import { buildInputManifest } from '../../../../lib/hover/manifest.ts'
import type { ScanJob, ScaleAnchor, ScanImage } from '../../../../lib/hover/types.ts'

export const runtime = 'nodejs'

function fail(error: string, status: number) {
  return NextResponse.json({ error }, { status })
}

/**
 * Build the immutable input manifest for a scan job. The returned manifestHash
 * is a SHA-256 over canonical bytes and is the reproducibility key for every
 * downstream stage.
 * Photos must already carry server-verified embedded GPS (see
 * /api/photo-provenance/verify); this route never certifies a client GPS claim.
 */
export async function POST(request: NextRequest) {
  const admin = createAdminClient()
  const header = request.headers.get('authorization') ?? ''
  let user
  if (/^Bearer\s+/i.test(header)) {
    const token = header.replace(/^Bearer\s+/i, '').trim()
    const verified = await admin.auth.getUser(token)
    user = verified.error ? null : verified.data.user
  } else {
    const supabase = await createClient()
    const verified = await supabase.auth.getUser()
    user = verified.error ? null : verified.data.user
  }
  if (!user) return fail('Authentication required.', 401)

  const parsed = await readJson(request, 4096)
  if ('error' in parsed) return fail(parsed.error, parsed.status)
  const jobId = (parsed.body as { jobId?: unknown })?.jobId
  if (!isUuid(jobId)) return fail('A valid scan job ID is required.', 400)

  const { data: job, error: jobError } = await admin.from('scan_jobs')
    .select('*').eq('id', jobId).maybeSingle()
  if (jobError) return fail('Scan job could not be read.', 503)
  if (!job) return fail('Scan job not found.', 404)
  const { data: member, error: memberError } = await admin.from('workspace_members')
    .select('role').eq('workspace_id', job.workspace_id).eq('user_id', user.id).maybeSingle()
  if (memberError) return fail('Workspace membership could not be verified.', 503)
  if (!member) return fail('Workspace membership required.', 403)
  const callerWorkspace = request.headers.get('x-workspace-id') ??
    (user.app_metadata?.workspace_id as string | undefined)
  if (!callerWorkspace) return fail('Workspace context required.', 400)
  try {
    assertWorkspaceMatch(job.workspace_id, callerWorkspace)
  } catch {
    return fail('Workspace mismatch.', 403)
  }

  const { data: imageRows, error: imagesError } = await admin.from('scan_images')
    .select('*').eq('job_id', jobId)
  if (imagesError) return fail('Scan images could not be read.', 503)
  const { data: anchorRows, error: anchorsError } = await admin.from('scale_anchors')
    .select('*').eq('job_id', jobId)
  if (anchorsError) return fail('Scale anchors could not be read.', 503)

  const images = (imageRows ?? []) as ScanImage[]
  const anchors = (anchorRows ?? []) as ScaleAnchor[]
  const unverified = images.filter((image) => image.role === 'model' && !image.gpsInFile)
  if (unverified.length) return fail('Unverified embedded GPS on model photos; recapture required.', 422)

  try {
    const manifest = buildInputManifest(job as ScanJob, images, anchors)
    const { error: updateError } = await admin.from('scan_jobs')
      .update({ status: 'ingested' }).eq('id', jobId)
    if (updateError) return fail('Scan job status could not be updated.', 503)
    return NextResponse.json({ manifest })
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Manifest could not be built.', 422)
  }
}
