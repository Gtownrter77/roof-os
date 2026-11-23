import { createHash } from 'node:crypto'
import { isCertifiedPhotoContent } from '../../../../lib/photo-provenance-integrity.mjs'
import { NextRequest, NextResponse } from 'next/server'
import { isUuid, readJson, requireWorkspaceMember } from '../../../../lib/api-security'
import { getSupabaseEnv } from '../../../../lib/supabase/env'
import { createClient } from '../../../../lib/supabase/server'
import { ManualTraceValidationError, validateManualTraceInput } from '../../../../lib/measurements/manual-trace-input'

export const runtime = 'nodejs'
const MAX_BODY_BYTES = 512 * 1024
const MAX_IMAGE_BYTES = 30 * 1024 * 1024
const PHOTO_BUCKET = 'inspection-photos'

class RouteError extends Error {
  constructor(readonly status: number, message: string) { super(message) }
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

async function boundedBytes(response: Response, maxBytes: number) {
  if (!response.body) throw new RouteError(502, 'The selected image could not be read.')
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const next = await reader.read()
      if (next.done) break
      size += next.value.byteLength
      if (size > maxBytes) {
        await reader.cancel().catch(() => undefined)
        throw new RouteError(413, 'The selected image exceeds the 30 MB limit.')
      }
      chunks.push(next.value)
    }
  } finally {
    reader.releaseLock()
  }
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)), size)
}

async function fetchBounded(url: string, timeoutMs: number, maxBytes: number) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, { signal: controller.signal, cache: 'no-store' })
    if (!response.ok) throw new RouteError(502, 'The selected image could not be retrieved from private storage.')
    return await boundedBytes(response, maxBytes)
  } catch (error) {
    if (error instanceof RouteError) throw error
    if (controller.signal.aborted) throw new RouteError(504, 'The selected image retrieval timed out.')
    throw new RouteError(502, 'The selected image could not be retrieved.')
  } finally {
    clearTimeout(timer)
  }
}

function isImage(bytes: Buffer) {
  return (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    || bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    || (bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP')
}

async function getContext() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, response: jsonError('Authentication required.', 401) }
  const { data: workspaceId, error } = await supabase.rpc('current_workspace_id')
  if (error || !isUuid(workspaceId)) return { supabase, response: jsonError('An active workspace is required.', 403) }
  const membership = await requireWorkspaceMember(supabase, user.id, workspaceId)
  if (membership.response) return { supabase, response: membership.response }
  return { supabase, user, workspaceId }
}

// Manual tracing is an authoritative measurement method, not an auto path.
// It still requires the same certified, GPS-verified original photo bytes as
// every other measurement route: evidence-only photos cannot start a trace.
export async function POST(request: NextRequest) {
  try {
    const context = await getContext()
    if ('response' in context) return context.response
    const parsed = await readJson(request, MAX_BODY_BYTES)
    if ('error' in parsed) return jsonError(parsed.error, parsed.status)

    let input
    try {
      input = validateManualTraceInput(parsed.body)
    } catch (error) {
      if (error instanceof ManualTraceValidationError) return jsonError(error.message, 400)
      throw error
    }

    const { supabase, user, workspaceId } = context
    const {
      inspectionId, photoId, imageWidth, imageHeight, planes,
      scaleReferencePixels, scaleReferenceFeet,
    } = input

    const { data: photo, error: photoError } = await supabase
      .from('inspection_photos')
      .select('id,workspace_id,inspection_id,uploaded_by,bucket_id,object_path,mime_type,file_size_bytes,upload_status,gps_verified,gps_address,gps_sha256,gps_latitude,gps_longitude')
      .eq('id', photoId)
      .eq('workspace_id', workspaceId)
      .eq('inspection_id', inspectionId)
      .maybeSingle()
    if (photoError) return jsonError('Photo access could not be verified.', 503)
    if (!photo || photo.bucket_id !== PHOTO_BUCKET || photo.upload_status !== 'uploaded') {
      return jsonError('The selected image is not available in this workspace.', 403)
    }
    if (photo.gps_verified !== true || typeof photo.gps_address !== 'string' || !photo.gps_address.trim()) {
      return jsonError('Hand tracing requires a server-verified embedded GPS and property address. Reverify the original photo before measuring.', 403)
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(photo.mime_type)
      || !/^[0-9a-f-]+\/(?:[0-9a-f-]+)\/(?:[0-9a-f-]+)\/[0-9a-f-]+\.(?:jpe?g|png|webp)$/i.test(photo.object_path)) {
      return jsonError('Only authorized JPEG, PNG, and WebP inspection images are supported.', 415)
    }

    const { url: supabaseUrl } = getSupabaseEnv()
    const signed = await supabase.storage.from(PHOTO_BUCKET).createSignedUrl(photo.object_path, 60)
    if (signed.error || !signed.data?.signedUrl) throw new RouteError(502, 'The selected image could not be signed for verification.')
    const signedUrl = new URL(signed.data.signedUrl, new URL(supabaseUrl).origin)
    if (signedUrl.origin !== new URL(supabaseUrl).origin) throw new RouteError(502, 'The selected image URL is not private storage.')
    const bytes = await fetchBounded(signedUrl.toString(), 15_000, MAX_IMAGE_BYTES)
    if (!bytes.length || !isImage(bytes)) return jsonError('The selected image failed image validation.', 415)
    const contentHash = createHash('sha256').update(bytes).digest('hex')
    if (!isCertifiedPhotoContent(photo, bytes)) {
      return jsonError('The stored photo no longer matches its verified embedded GPS. Reverify the original photo before measuring.', 403)
    }

    const pixelsPerFoot = Math.round((scaleReferencePixels / scaleReferenceFeet) * 1_000_000) / 1_000_000
    if (!Number.isFinite(pixelsPerFoot) || pixelsPerFoot <= 0) return jsonError('The calibration ratio is invalid.', 400)
    const sourceReference = `inspection-photo:${photoId}:sha256:${contentHash}`
    const reviewedAt = new Date().toISOString()

    const { data: measurement, error: measurementError } = await supabase
      .from('aerial_measurements')
      .insert({
        workspace_id: workspaceId,
        inspection_id: inspectionId,
        source_photo_id: photoId,
        image_width: imageWidth,
        image_height: imageHeight,
        status: 'draft',
        calibration_status: 'calibrated',
        measurement_source: 'manual_traced',
        scale_reference_pixels: scaleReferencePixels,
        scale_reference_feet: scaleReferenceFeet,
        pixels_per_foot: pixelsPerFoot,
        calibrated_by: user.id,
        calibrated_at: reviewedAt,
        created_by: user.id,
      })
      .select('id,status,calibration_status,measurement_source')
      .single()
    if (measurementError || !measurement) return jsonError('The hand-traced measurement could not be saved.', 502)

    const planeRows = planes.map((plane) => ({
      aerial_measurement_id: measurement.id,
      workspace_id: workspaceId,
      vertices: plane.vertices,
      suggested_pitch: null,
      reviewed_pitch_rise_per_12: plane.pitchRisePer12,
      confidence: 'high',
      source_image_reference: sourceReference,
      is_suggested: false,
      review_status: 'accepted',
      reviewed_by: user.id,
      reviewed_at: reviewedAt,
      created_by: user.id,
    }))
    const { error: planeError } = await supabase.from('roof_planes').insert(planeRows).select('id')
    if (planeError) return jsonError('Hand-traced roof planes could not be saved.', 502)

    return NextResponse.json({
      measurement: {
        id: measurement.id,
        measurement_source: 'manual_traced',
        status: 'draft',
        calibration_status: 'calibrated',
      },
    }, { status: 201 })
  } catch (error) {
    if (error instanceof RouteError) return jsonError(error.message, error.status)
    return jsonError('Hand-traced geometry could not be validated or saved.', 500)
  }
}
