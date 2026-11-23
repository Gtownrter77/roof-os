import { createHash } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '../../../../lib/supabase/admin'
import { createClient } from '../../../../lib/supabase/server'
import { getSupabaseEnv } from '../../../../lib/supabase/env'
import { isUuid, readJson } from '../../../../lib/api-security'
import { assertWorkspaceMatch } from '../../../../lib/hover/util.ts'
import { buildInputManifest } from '../../../../lib/hover/manifest.ts'
import {
  anchorIdempotencyKey,
  mapInspectionPhoto,
  newJobForDraft,
  uuidFromKey,
  type InspectionDraftRow,
  type InspectionPhotoRow,
  type IngestAnchorInput,
} from '../../../../lib/hover/field-ingest.ts'
import { readEmbeddedGps } from '../../../../lib/photo-provenance.mjs'
import { fetchPrivatePhotoBytes } from '../../../../lib/photo-provenance-io'
import type { ScanJob, ScaleAnchor, ScanImage } from '../../../../lib/hover/types.ts'

export const runtime = 'nodejs'

const BUCKET = 'inspection-photos'
const MAX_BYTES = 30 * 1024 * 1024
const ANCHOR_KINDS = new Set(['door', 'garage', 'wall', 'bar', 'gps', 'footprint'])

function fail(error: string, status: number) {
  return NextResponse.json({ error }, { status })
}

function toScanJob(row: Record<string, unknown>): ScanJob {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    propertyId: (row.property_id as string | null) ?? null,
    status: (row.status as ScanJob['status']) ?? 'capturing',
    captureMode: (row.capture_mode as ScanJob['captureMode']) ?? 'exterior',
    deliverable: (row.deliverable as ScanJob['deliverable']) ?? 'full_exterior',
    providerPath: (row.provider_path as ScanJob['providerPath']) ?? 'oss',
    slaTier: (row.sla_tier as ScanJob['slaTier']) ?? 'visual-twin',
    ownerLockSequence: Array.isArray(row.owner_lock_sequence) ? row.owner_lock_sequence as string[] : [],
    createdBy: (row.created_by as string | null) ?? null,
    createdAt: String(row.created_at ?? new Date().toISOString()),
  }
}

function parseAnchor(value: unknown): IngestAnchorInput | null {
  if (!value || typeof value !== 'object') return null
  const candidate = value as Record<string, unknown>
  const observedValue = Number(candidate.observedValue)
  if (!ANCHOR_KINDS.has(String(candidate.kind))
    || !Number.isFinite(observedValue) || observedValue <= 0
    || !['ft', 'm'].includes(String(candidate.unit))) return null
  return {
    kind: String(candidate.kind),
    observedValue,
    unit: candidate.unit as 'ft' | 'm',
    sourceImageId: isUuid(candidate.sourceImageId) ? candidate.sourceImageId as string : null,
  }
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
  const body = parsed.body as {
    jobId?: unknown
    inspectionDraftId?: unknown
    anchors?: unknown
  }
  const callerWorkspace = request.headers.get('x-workspace-id') ??
    (user.app_metadata?.workspace_id as string | undefined)
  if (!callerWorkspace) return fail('Workspace context required.', 400)

  let jobId = isUuid(body.jobId) ? body.jobId as string : null
  const inspectionDraftId = isUuid(body.inspectionDraftId) ? body.inspectionDraftId as string : null
  if (!jobId && !inspectionDraftId) {
    return fail('A valid scan job ID or inspection draft ID is required.', 400)
  }

  // Draft mode: one scan job per inspection draft, created on first upload and
  // reused deterministically on every subsequent photo or anchor sync.
  if (!jobId && inspectionDraftId) {
    const { data: draft, error: draftError } = await admin.from('inspection_sessions')
      .select('id,workspace_id,created_by').eq('id', inspectionDraftId).maybeSingle()
    if (draftError) return fail('Inspection draft could not be read.', 503)
    if (!draft) return fail('Inspection draft not found.', 404)
    const draftRow = draft as InspectionDraftRow
    try {
      assertWorkspaceMatch(draftRow.workspace_id, callerWorkspace)
    } catch {
      return fail('Workspace mismatch.', 403)
    }
    const { data: member, error: memberError } = await admin.from('workspace_members')
      .select('role').eq('workspace_id', draftRow.workspace_id).eq('user_id', user.id).maybeSingle()
    if (memberError) return fail('Workspace membership could not be verified.', 503)
    if (!member || draftRow.created_by !== user.id) return fail('Draft ingest is not authorized.', 403)

    const resolvedJobId = uuidFromKey(`scan-job:${draftRow.workspace_id}:${draftRow.id}`)
    const { data: existingJob, error: existingJobError } = await admin.from('scan_jobs')
      .select('id').eq('id', resolvedJobId).maybeSingle()
    if (existingJobError) return fail('Scan job could not be read.', 503)
    if (!existingJob) {
      const { error: createJobError } = await admin.from('scan_jobs').insert({
        ...newJobForDraft(draftRow),
        id: resolvedJobId,
        created_by: draftRow.created_by,
      })
      if (createJobError) {
        // A concurrent first upload may have won the race; re-read instead of
        // fabricating a second job for the same draft.
        const { data: racedJob, error: racedJobError } = await admin.from('scan_jobs')
          .select('id').eq('id', resolvedJobId).maybeSingle()
        if (racedJobError || !racedJob) return fail('Scan job could not be created.', 503)
      }
    }
    jobId = resolvedJobId

    const { data: photoRows, error: photosError } = await admin.from('inspection_photos')
      .select('*').eq('inspection_id', draftRow.id).eq('workspace_id', draftRow.workspace_id)
    if (photosError) return fail('Uploaded photos could not be read.', 503)

    const imageInserts: Array<Record<string, unknown>> = []
    for (const raw of photoRows ?? []) {
      const photo = raw as InspectionPhotoRow
      const expectedPrefix = [photo.workspace_id, photo.uploaded_by, photo.inspection_id].join('/') + '/'
      if (photo.bucket_id !== BUCKET || !photo.object_path.startsWith(expectedPrefix)) {
        return fail('Invalid private photo storage path.', 403)
      }
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(String((raw as Record<string, unknown>).mime_type))) {
        return fail('Only JPEG, PNG and WebP evidence is supported.', 415)
      }
      const declaredSize = Number((raw as Record<string, unknown>).file_size_bytes)
      if (Number.isFinite(declaredSize) && declaredSize > MAX_BYTES) return fail('The original photo exceeds 30 MB.', 413)

      const { url } = getSupabaseEnv()
      const signed = await admin.storage.from(BUCKET).createSignedUrl(photo.object_path, 60)
      if (signed.error || !signed.data?.signedUrl) return fail('A private photo cannot be read.', 503)
      const signedUrl = new URL(signed.data.signedUrl, url)
      if (signedUrl.origin !== new URL(url).origin) return fail('Invalid private storage origin.', 403)
      let bytes: Uint8Array
      try {
        bytes = await fetchPrivatePhotoBytes(signedUrl, MAX_BYTES, 15_000)
      } catch {
        return fail('A private photo could not be byte-verified; nothing was written to the scan.', 503)
      }
      const gps = readEmbeddedGps(bytes)
      // GPS alone is not property identity: require coordinates AND a bounded,
      // non-empty embedded address before the server certifies gps_in_file.
      const verifiedGpsInFile = Boolean(
        gps && Number.isFinite(gps.latitude) && Number.isFinite(gps.longitude)
        && Math.abs(gps.latitude) <= 90 && Math.abs(gps.longitude) <= 180
        && gps.address?.trim() && gps.address.length <= 250,
      )
      const digest = {
        sha256: createHash('sha256').update(bytes).digest('hex'),
        byteSize: bytes.byteLength,
      }
      const image = mapInspectionPhoto(photo, verifiedGpsInFile, digest)
      imageInserts.push({
        id: image.id,
        job_id: jobId,
        workspace_id: image.workspaceId,
        storage_path: image.storagePath,
        sha256: image.sha256,
        byte_size: image.byteSize,
        slot: image.slot,
        role: image.role,
        gps_in_file: image.gpsInFile,
        exif_json: {},
        blur_score: image.blurScore,
        light_score: image.lightScore,
        captured_at: image.capturedAt,
      })
    }

    const parsedAnchors: IngestAnchorInput[] = []
    if (body.anchors !== undefined) {
      if (!Array.isArray(body.anchors)) return fail('Anchors must be an array.', 400)
      for (const raw of body.anchors) {
        const anchor = parseAnchor(raw)
        if (!anchor) return fail('Invalid reference measurement.', 422)
        parsedAnchors.push(anchor)
      }
    }
    if (imageInserts.length) {
      const { error: imagesUpsertError } = await admin
        .from('scan_images').upsert(imageInserts, { onConflict: 'id' })
      if (imagesUpsertError) return fail('Scan images could not be written.', 503)
    }
    if (parsedAnchors.length) {
      const anchorInserts = parsedAnchors.map((anchor) => ({
        id: uuidFromKey(anchorIdempotencyKey(draftRow.workspace_id, draftRow.id, anchor)),
        workspace_id: draftRow.workspace_id,
        job_id: jobId,
        kind: anchor.kind,
        observed_value: anchor.observedValue,
        unit: anchor.unit,
        source_image_id: anchor.sourceImageId,
        confidence: 1,
      }))
      const { error: anchorsUpsertError } = await admin
        .from('scale_anchors').upsert(anchorInserts, { onConflict: 'id' })
      if (anchorsUpsertError) return fail('Scale anchors could not be written.', 503)
    }
  }

  if (!jobId) return fail('A valid scan job ID is required.', 400)

  const { data: job, error: jobError } = await admin.from('scan_jobs')
    .select('*').eq('id', jobId).maybeSingle()
  if (jobError) return fail('Scan job could not be read.', 503)
  if (!job) return fail('Scan job not found.', 404)
  const { data: member, error: memberError } = await admin.from('workspace_members')
    .select('role').eq('workspace_id', job.workspace_id).eq('user_id', user.id).maybeSingle()
  if (memberError) return fail('Workspace membership could not be verified.', 503)
  if (!member) return fail('Workspace membership required.', 403)
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
  const anchors: ScaleAnchor[] = (anchorRows ?? []).map((row) => ({
    id: String(row.id),
    jobId: String(row.job_id),
    kind: row.kind as ScaleAnchor['kind'],
    observedValue: Number(row.observed_value),
    unit: row.unit as 'ft' | 'm',
    sourceImageId: (row.source_image_id as string | null) ?? null,
    confidence: Number(row.confidence),
  }))
  const unverified = images.filter((image) => image.role === 'model' && !image.gpsInFile)
  if (unverified.length) return fail('Unverified embedded GPS on model photos; recapture required.', 422)

  try {
    const manifest = buildInputManifest(toScanJob(job as Record<string, unknown>), images, anchors)
    const { error: updateError } = await admin.from('scan_jobs')
      .update({ status: 'ingested' }).eq('id', jobId)
    if (updateError) return fail('Scan job status could not be updated.', 503)
    return NextResponse.json({ manifest })
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Manifest could not be built.', 422)
  }
}
