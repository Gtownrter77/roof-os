import { createHash } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { analyzeRoofGeometryWithGemini, GeminiVisionError, getGeminiVisionModel } from '../../../../../lib/ai/gemini-vision.mjs'
import { GEOMETRY_CONTRACT_VERSION, GeometryContractValidationError, validateGeometrySuggestion } from '../../../../../lib/ai/geometry-contract'
import { createAdminClient } from '../../../../../lib/supabase/admin'
import { getSupabaseEnv } from '../../../../../lib/supabase/env'
import { isUuid, readJson, requireWorkspaceMember } from '../../../../../lib/api-security'
import { createClient } from '../../../../../lib/supabase/server'

export const runtime = 'nodejs'
export const maxDuration = 120

const BUCKET = 'inspection-photos'
const MAX_IMAGE_BYTES = 30 * 1024 * 1024
const STORAGE_TIMEOUT_MS = 15_000
const PROVIDER_TIMEOUT_MS = 90_000
const PROMPT = [
  `Analyze the supplied roof image and return exactly one JSON object matching ROOF/OS geometry contract ${GEOMETRY_CONTRACT_VERSION}. No Markdown and no extra keys.`,
  'Coordinates must be pixel coordinates in the original supplied image, using the exact image_width and image_height supplied below.',
  'Suggest roof planes as non-self-intersecting polygons, roof edges classified as eave/rake/ridge/hip/valley/transition/step_flashing/other, and roof objects as skylight/chimney/hvac/pipe_boot/attic_vent/other.',
  'Use low/medium/high only as qualitative confidence labels, not calibrated probabilities.',
  'Do not invent or return scale, feet, square feet, roofing squares, linear feet, quantities, numeric pitch ratios, dimensions, or confirmed measurements.',
  'If the roof is not clearly visible, return empty arrays and a warning. Do not guess hidden geometry.',
  'Set source_image_reference to the exact source reference provided below.',
  'Every suggestion is unverified and must be reviewed by a human and calibrated before any quantity is calculated.',
].join('\\n')

class RouteError extends Error {
  constructor(readonly status: number, message: string) { super(message) }
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

function isExpectedImage(bytes: Buffer, mimeType: string) {
  if (mimeType === 'image/jpeg') return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  if (mimeType === 'image/png') return bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  return mimeType === 'image/webp' && bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP'
}

async function readBounded(response: Response) {
  const declared = response.headers.get('content-length')
  if (declared && /^\\d+$/.test(declared) && Number(declared) > MAX_IMAGE_BYTES) {
    await response.body?.cancel().catch(() => undefined)
    throw new RouteError(413, 'The selected roof image exceeds the 30 MB limit.')
  }
  if (!response.body) throw new RouteError(502, 'The selected roof image could not be read.')
  const reader = response.body.getReader()
  const chunks: Buffer[] = []
  let size = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > MAX_IMAGE_BYTES) {
        await reader.cancel().catch(() => undefined)
        throw new RouteError(413, 'The selected roof image exceeds the 30 MB limit.')
      }
      chunks.push(Buffer.from(value))
    }
  } finally {
    reader.releaseLock()
  }
  return Buffer.concat(chunks, size)
}

function rejectUnsafeClaims(value: unknown, path = 'root') {
  if (Array.isArray(value)) {
    value.forEach((item, index) => rejectUnsafeClaims(item, `${path}[${index}]`))
    return
  }
  if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) rejectUnsafeClaims(item, `${path}.${key}`)
    return
  }
  if (typeof value === 'string' && ( /\\$\\s*\\d|\\b\\d+(?:\\.\\d+)?\\s*(?:sq\\.?\\s*ft|sqft|square feet|linear feet|feet|foot|ft|inches?)\\b|\\b\\d+(?:\\.\\d+)?\\s*(?:\\/|:)\\s*\\d+(?:\\.\\d+)?\\b|\\b(?:certified|verified|guaranteed|engineered|exact measurement)\\b/i.test(value) )) {
    throw new RouteError(502, `Gemini returned an unsupported measurement claim in ${path}. Manual tracing remains available.`)
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return jsonError('Authentication required.', 401)

    const { data: workspaceId, error: workspaceError } = await supabase.rpc('current_workspace_id')
    if (workspaceError || !isUuid(workspaceId)) return jsonError('An active workspace is required.', 403)
    const membership = await requireWorkspaceMember(supabase, user.id, workspaceId)
    if (membership.response) return membership.response

    const parsed = await readJson(request, 8 * 1024)
    if ('error' in parsed) return jsonError(parsed.error, parsed.status)
    if (Object.keys(parsed.body).some((key) => !['photoId', 'inspectionId', 'imageWidth', 'imageHeight'].includes(key))) {
      return jsonError('Only photoId, inspectionId, imageWidth, and imageHeight are supported.', 400)
    }
    const { photoId, inspectionId } = parsed.body
    const width = Number(parsed.body.imageWidth)
    const height = Number(parsed.body.imageHeight)
    if (!isUuid(photoId) || !isUuid(inspectionId)) return jsonError('Valid photoId and inspectionId are required.', 400)
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 100_000 || height > 100_000) {
      return jsonError('Valid original image dimensions are required.', 400)
    }

    const { data: photo, error: photoError } = await supabase
      .from('inspection_photos')
      .select('id,workspace_id,inspection_id,uploaded_by,bucket_id,object_path,mime_type,file_size_bytes,upload_status')
      .eq('id', photoId)
      .eq('workspace_id', workspaceId)
      .eq('inspection_id', inspectionId)
      .maybeSingle()
    if (photoError) return jsonError('Photo access could not be verified.', 503)
    if (!photo || photo.uploaded_by !== user.id || photo.bucket_id !== BUCKET || photo.upload_status !== 'uploaded') {
      return jsonError('The selected roof photo is not available to this user in this workspace.', 403)
    }
    const extension = photo.mime_type === 'image/jpeg' ? /\\.jpe?g$/i
      : photo.mime_type === 'image/png' ? /\\.png$/i
      : photo.mime_type === 'image/webp' ? /\\.webp$/i : null
    const expectedPath = `${workspaceId}/${user.id}/${inspectionId}/`
    if (!extension || !photo.object_path.startsWith(expectedPath) || !extension.test(photo.object_path)
      || !photo.object_path.endsWith(`${photoId}.${photo.object_path.split('.').pop()}`)) {
      return jsonError('The photo does not use an authorized private-storage path or supported image type.', 415)
    }
    if (photo.file_size_bytes !== null && Number(photo.file_size_bytes) > MAX_IMAGE_BYTES) {
      return jsonError('The selected roof image exceeds the 30 MB limit.', 413)
    }

    const admin = createAdminClient()
    const { data: allowed, error: limitError } = await admin.rpc('consume_public_rate_limit', {
      p_bucket: `roof-gemini:${workspaceId}:${user.id}`,
      p_limit: 5,
      p_window_seconds: 3600,
    })
    if (limitError) return jsonError('Roof AI usage protection could not be verified. Please try again later.', 503)
    if (allowed !== true) return jsonError('This account has reached its roof AI limit for this hour. Please try again later.', 429)

    const { url: supabaseUrl } = getSupabaseEnv()
    const storageOrigin = new URL(supabaseUrl).origin
    const signed = await supabase.storage.from(BUCKET).createSignedUrl(photo.object_path, 60)
    if (signed.error || !signed.data?.signedUrl) throw new RouteError(502, 'The selected roof photo could not be signed for private reading.')
    const signedUrl = new URL(signed.data.signedUrl, storageOrigin)
    if (signedUrl.origin !== storageOrigin) throw new RouteError(502, 'The selected roof photo is not in authorized private storage.')

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), STORAGE_TIMEOUT_MS)
    let bytes: Buffer
    try {
      const response = await fetch(signedUrl.toString(), { signal: controller.signal, cache: 'no-store' })
      if (!response.ok) throw new RouteError(502, 'The selected roof photo could not be retrieved from private storage.')
      bytes = await readBounded(response)
    } catch (error) {
      if (error instanceof RouteError) throw error
      if (controller.signal.aborted) throw new RouteError(504, 'Private roof photo retrieval timed out.')
      throw new RouteError(502, 'The selected roof photo could not be retrieved.')
    } finally {
      clearTimeout(timer)
    }
    if (!bytes.length || !isExpectedImage(bytes, photo.mime_type)) throw new RouteError(415, 'The selected roof photo failed image validation.')

    const hash = createHash('sha256').update(bytes).digest('hex')
    const sourceReference = `inspection-photo:${photoId}:sha256:${hash}`
    const prompt = `${PROMPT}\\nOriginal image dimensions: ${width} by ${height} pixels.\\nSource reference: ${sourceReference}`
    const result = await analyzeRoofGeometryWithGemini({
      prompt,
      photo: { mimeType: photo.mime_type, bytes },
      timeoutMs: PROVIDER_TIMEOUT_MS,
    })

    let candidate: unknown
    try {
      candidate = JSON.parse(result.text)
    } catch {
      throw new RouteError(502, 'Gemini returned malformed roof geometry. Manual tracing remains available.')
    }
    let suggestion
    try {
      suggestion = validateGeometrySuggestion(candidate)
      rejectUnsafeClaims(suggestion)
    } catch (error) {
      if (error instanceof RouteError) throw error
      if (error instanceof GeometryContractValidationError) throw new RouteError(502, 'Gemini geometry failed ROOF/OS validation. Manual tracing remains available.')
      throw error
    }
    if (suggestion.image_width !== width || suggestion.image_height !== height) {
      throw new RouteError(502, 'Gemini returned geometry for different image dimensions. Manual tracing remains available.')
    }
    suggestion = { ...suggestion, source_image_reference: sourceReference }
    return NextResponse.json({
      suggestion,
      model: result.model,
      provider: 'google-gemini',
      warning: 'AI geometry is an unverified suggestion. Review every plane, edge, and object, then calibrate with a known reference before calculating quantities.',
    })
  } catch (error) {
    if (error instanceof RouteError) return jsonError(error.message, error.status)
    if (error instanceof GeminiVisionError) return jsonError(error.message, error.status)
    return jsonError('Hosted roof analysis could not be completed. Manual tracing remains available.', 500)
  }
}
