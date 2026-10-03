import { createHash } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { AIContractValidationError, ROOF_AI_CONTRACT_VERSION, ROOF_AI_DISCLAIMER, validateRoofAIObservationPacket } from '../../../../lib/ai/roof-contract'
import { createGeminiGenerateContentRequest } from '../../../../lib/ai/gemini-request.mjs'
import { isUuid, readJson, requireWorkspaceMember } from '../../../../lib/api-security'
import { getSupabaseEnv } from '../../../../lib/supabase/env'
import { createClient } from '../../../../lib/supabase/server'

export const runtime = 'nodejs'
export const maxDuration = 120

const BUCKET = 'inspection-photos'
const MODEL_ID = 'gemini-2.5-flash'
const MAX_PHOTOS = 50
const MAX_TOTAL_BYTES = 30 * 1024 * 1024
const MAX_PROVIDER_RESPONSE_BYTES = 2 * 1024 * 1024
const REQUEST_BUDGET_MS = 110_000
const STORAGE_TIMEOUT_MS = 15_000
const PROVIDER_TIMEOUT_MS = 90_000

type WorkflowRow = {
  id: string
  workspace_id: string
  inspection_id: string | null
  source_photo_ids: unknown
  ai_analysis: unknown
  ai_content_hash: string | null
  ai_model_version: string | null
}

type PhotoRow = {
  id: string
  workspace_id: string
  inspection_id: string
  uploaded_by: string
  bucket_id: string
  object_path: string
  mime_type: string
  file_size_bytes: number | string | null
  upload_status: string
}

type PreparedPhoto = { mimeType: string; bytes: Buffer; hash: string }

class RouteError extends Error {
  constructor(readonly status: number, message: string) {
    super(message)
  }
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function mimeAndExtensionMatch(mimeType: string, path: string) {
  const extension = path.split('.').pop()?.toLowerCase()
  return (mimeType === 'image/jpeg' && (extension === 'jpg' || extension === 'jpeg'))
    || (mimeType === 'image/png' && extension === 'png')
    || (mimeType === 'image/webp' && extension === 'webp')
}

function isExpectedImage(bytes: Buffer, mimeType: string) {
  if (mimeType === 'image/jpeg') return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  if (mimeType === 'image/png') return bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  return mimeType === 'image/webp'
    && bytes.length >= 12
    && bytes.toString('ascii', 0, 4) === 'RIFF'
    && bytes.toString('ascii', 8, 12) === 'WEBP'
}

function validStoragePath(photo: PhotoRow, workspaceId: string) {
  if (!isUuid(photo.uploaded_by) || !isUuid(photo.inspection_id)) return false
  const parts = photo.object_path.split('/')
  if (parts.length !== 4 || parts[0] !== workspaceId || parts[1] !== photo.uploaded_by || parts[2] !== photo.inspection_id) return false
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:jpe?g|png|webp)$/i.test(parts[3])
}

async function readBoundedBody(response: Response, maxBytes: number, tooLargeMessage: string, tooLargeStatus = 413): Promise<Buffer> {
  const lengthHeader = response.headers.get('content-length')
  if (lengthHeader && /^\d+$/.test(lengthHeader) && Number(lengthHeader) > maxBytes) {
    await response.body?.cancel().catch(() => undefined)
    throw new RouteError(tooLargeStatus, tooLargeMessage)
  }
  if (!response.body) throw new RouteError(502, 'A photo or AI response could not be read.')
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > maxBytes) {
        await reader.cancel().catch(() => undefined)
        throw new RouteError(tooLargeStatus, tooLargeMessage)
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)), size)
}

async function fetchBytesWithinBudget(url: string, remainingBytes: number, deadline: number): Promise<Buffer> {
  const timeoutMs = Math.min(STORAGE_TIMEOUT_MS, deadline - Date.now())
  if (timeoutMs <= 0) throw new RouteError(504, 'Photo analysis timed out. Please try again.')
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, { signal: controller.signal, cache: 'no-store' })
    if (!response.ok) throw new RouteError(502, 'A selected photo could not be retrieved from private storage.')
    return await readBoundedBody(response, remainingBytes, 'The selected photos exceed the 30 MB total limit.')
  } catch (error) {
    if (error instanceof RouteError) throw error
    if (controller.signal.aborted) throw new RouteError(504, 'Photo analysis timed out while retrieving images. Please try again.')
    throw new RouteError(502, 'A selected photo could not be retrieved from private storage.')
  } finally {
    clearTimeout(timer)
  }
}

async function fetchTextWithinTimeout(url: string, init: RequestInit, timeoutMs: number, responseLimit: number) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, { ...init, signal: controller.signal, cache: 'no-store' })
    const body = await readBoundedBody(response, responseLimit, 'The AI provider response exceeded the allowed size.', 502)
    return { response, text: body.toString('utf8') }
  } catch (error) {
    if (error instanceof RouteError) throw error
    if (controller.signal.aborted) throw new RouteError(504, 'AI analysis timed out. Please try again.')
    throw new RouteError(503, 'AI analysis is temporarily unavailable. Please try again.')
  } finally {
    clearTimeout(timer)
  }
}

function canonicalContentHash(photos: PreparedPhoto[]) {
  const sortedHashes = photos.map((photo) => photo.hash).sort()
  return createHash('sha256').update(JSON.stringify(sortedHashes)).digest('hex')
}

function rejectUnsafeClaims(value: unknown, path = 'root') {
  if (Array.isArray(value)) {
    value.forEach((item, index) => rejectUnsafeClaims(item, `${path}[${index}]`))
    return
  }
  if (!isRecord(value)) {
    if (typeof value === 'string') {
      const prohibited = /(?:\$\s*\d|\b(?:USD|pricing|price quote|estimated cost|coverage approved|claim payable|claim approved|claim denied|code violation|code compliant|code determination|certified measurement|verified measurement|exact pitch)\b)/i
      if (prohibited.test(value)) throw new AIContractValidationError(path, 'Prohibited pricing, claim, code, or authoritative measurement language')
    }
    return
  }
  for (const [key, item] of Object.entries(value)) {
    if (key === 'authority_disclaimer') continue
    rejectUnsafeClaims(item, `${path}.${key}`)
  }
}

const SYSTEM_INSTRUCTIONS = [
  'Analyze the supplied roof photographs only as non-authoritative visual observations.',
  'Return exactly one JSON object matching ROOF/OS AI Visual Observation Contract version 1.0.0; no Markdown fences and no extra keys.',
  'Use photo_index values matching the supplied image order, starting at zero. Include an image_audit entry for each supplied image.',
  'Do not produce dimensions, areas, roof squares, quantities, linear feet, numeric pitch ratios, prices, costs, estimates, insurance/claim decisions, or building-code determinations.',
  'Do not describe any observation as certified, verified, official, guaranteed, engineered, exact, or authoritative. All findings are unverified AI observations.',
  'Use only contract enum values. Include the exact contract disclaimer and contract version. If uncertain, choose indeterminate or low confidence.',
  `Required constants: contract_version=${ROOF_AI_CONTRACT_VERSION}; measurement_status=unverified_ai_observation; authority_disclaimer=${ROOF_AI_DISCLAIMER}`,
].join('\n')

export async function POST(request: NextRequest) {
  const deadline = Date.now() + REQUEST_BUDGET_MS
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return jsonError('Authentication required.', 401)

    const { data: workspaceId, error: workspaceError } = await supabase.rpc('current_workspace_id')
    if (workspaceError) return jsonError('Workspace authorization could not be verified.', 503)
    if (!isUuid(workspaceId)) return jsonError('An active workspace is required.', 403)
    const membership = await requireWorkspaceMember(supabase, user.id, workspaceId)
    if (membership.response) return membership.response
    const { data: isAdmin, error: roleError } = await supabase.rpc('is_workspace_admin', { target_workspace: workspaceId })
    if (roleError) return jsonError('Workspace authorization could not be verified.', 503)
    if (!isAdmin) return jsonError('Workspace administrator access is required to save AI analysis.', 403)

    const parsed = await readJson(request, 8 * 1024)
    if ('error' in parsed) return jsonError(parsed.error, parsed.status)
    if (Object.keys(parsed.body).some((key) => key !== 'workflowId' && key !== 'forceRefresh')) {
      return jsonError('Only workflowId and forceRefresh are supported.', 400)
    }
    const workflowId = parsed.body.workflowId
    const forceRefresh = parsed.body.forceRefresh ?? false
    if (!isUuid(workflowId)) return jsonError('A valid workflowId is required.', 400)
    if (typeof forceRefresh !== 'boolean') return jsonError('forceRefresh must be a boolean.', 400)

    const { data: workflow, error: workflowError } = await supabase
      .from('photo_estimate_workflows')
      .select('id,workspace_id,inspection_id,source_photo_ids,ai_analysis,ai_content_hash,ai_model_version')
      .eq('id', workflowId)
      .eq('workspace_id', workspaceId)
      .maybeSingle()
    if (workflowError) return jsonError('The workflow could not be loaded.', 503)
    if (!workflow) return jsonError('Workflow not found in this workspace.', 404)

    const workflowRow = workflow as WorkflowRow
    const photoIds = workflowRow.source_photo_ids
    if (!Array.isArray(photoIds) || photoIds.length < 1 || photoIds.length > MAX_PHOTOS || photoIds.some((id) => !isUuid(id)) || new Set(photoIds).size !== photoIds.length) {
      return jsonError(`The workflow must reference 1–${MAX_PHOTOS} unique photos.`, 400)
    }

    const { data: rows, error: photoError } = await supabase
      .from('inspection_photos')
      .select('id,workspace_id,inspection_id,uploaded_by,bucket_id,object_path,mime_type,file_size_bytes,upload_status')
      .in('id', photoIds)
      .eq('workspace_id', workspaceId)
      .eq('bucket_id', BUCKET)
      .eq('upload_status', 'uploaded')
      .then((result) => result)
    if (photoError) return jsonError('Photo access could not be verified.', 503)

    const photoRows = (rows ?? []) as PhotoRow[]
    const byId = new Map(photoRows.map((photo) => [photo.id, photo]))
    const orderedRows = photoIds.map((id) => byId.get(id))
    if (orderedRows.some((photo) => !photo || photo.workspace_id !== workspaceId || (workflowRow.inspection_id && photo.inspection_id !== workflowRow.inspection_id))) {
      return jsonError('One or more workflow photos are unavailable in this workspace and inspection.', 403)
    }

    const authorizedRows = orderedRows as PhotoRow[]

    let declaredTotal = 0
    const expectedMimeTypes = new Map<string, string>()
    for (const photo of authorizedRows) {
      if (photo.bucket_id !== BUCKET || !validStoragePath(photo, workspaceId)) {
        return jsonError('A workflow photo does not use an authorized private-storage path.', 403)
      }
      if (photo.inspection_id !== workflowRow.inspection_id && workflowRow.inspection_id !== null) {
        return jsonError('A workflow photo does not belong to the selected inspection.', 403)
      }
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(photo.mime_type) || !mimeAndExtensionMatch(photo.mime_type, photo.object_path)) {
        return jsonError('Only JPEG, PNG, and WebP workflow photos are supported.', 415)
      }
      expectedMimeTypes.set(photo.id, photo.mime_type)
      if (photo.file_size_bytes !== null) {
        const size = Number(photo.file_size_bytes)
        if (!Number.isSafeInteger(size) || size <= 0) return jsonError('A workflow photo has invalid size metadata.', 400)
        declaredTotal += size
        if (declaredTotal > MAX_TOTAL_BYTES) return jsonError('The selected photos exceed the 30 MB total limit.', 413)
      }
    }

    const { url: supabaseUrl } = getSupabaseEnv()
    const supabaseOrigin = new URL(supabaseUrl).origin
    const preparedPhotos: PreparedPhoto[] = []
    let totalBytes = 0
    for (const photo of authorizedRows) {
      if (Date.now() >= deadline) throw new RouteError(504, 'Photo analysis timed out. Please try again.')
      const { data: signed, error: signedError } = await supabase.storage.from(BUCKET).createSignedUrl(photo.object_path, 60)
      if (signedError || !signed?.signedUrl) throw new RouteError(502, 'A selected photo could not be retrieved from private storage.')
      let signedUrl: URL
      try {
        signedUrl = new URL(signed.signedUrl, supabaseOrigin)
      } catch {
        throw new RouteError(502, 'A selected photo could not be retrieved from private storage.')
      }
      if (signedUrl.origin !== supabaseOrigin) throw new RouteError(502, 'A selected photo could not be retrieved from private storage.')

      const remaining = MAX_TOTAL_BYTES - totalBytes
      const bytes = await fetchBytesWithinBudget(signedUrl.toString(), remaining, deadline)
      if (bytes.length === 0 || !isExpectedImage(bytes, expectedMimeTypes.get(photo.id) ?? '')) {
        throw new RouteError(415, 'A workflow photo does not match its declared JPEG, PNG, or WebP type.')
      }
      totalBytes += bytes.length
      preparedPhotos.push({ mimeType: expectedMimeTypes.get(photo.id)!, bytes, hash: createHash('sha256').update(bytes).digest('hex') })
    }

    const contentHash = canonicalContentHash(preparedPhotos)
    if (!forceRefresh && workflowRow.ai_content_hash === contentHash && workflowRow.ai_model_version === MODEL_ID && workflowRow.ai_analysis) {
      try {
        const cached = validateRoofAIObservationPacket(workflowRow.ai_analysis, preparedPhotos.length)
        if (cached.model_id === MODEL_ID) {
          return NextResponse.json({ workflowId, analysis: cached, cached: true, contentHash })
        }
      } catch {
        // Invalid or legacy cache entries are never served; regenerate below.
      }
    }

    const apiKey = process.env.GEMINI_API_KEY?.trim()
    if (!apiKey) return jsonError('AI analysis is not configured on this server.', 503)

    const contents = {
      contents: [{
        role: 'user',
        parts: [
          { text: SYSTEM_INSTRUCTIONS },
          ...preparedPhotos.map((photo) => ({ inline_data: { mime_type: photo.mimeType, data: photo.bytes.toString('base64') } })),
        ],
      }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.1, maxOutputTokens: 8192 },
    }
    const providerRequest = createGeminiGenerateContentRequest(MODEL_ID, apiKey, contents)

    const timeoutMs = Math.min(PROVIDER_TIMEOUT_MS, deadline - Date.now())
    if (timeoutMs <= 0) throw new RouteError(504, 'AI analysis timed out. Please try again.')
    const provider = await fetchTextWithinTimeout(providerRequest.url, providerRequest.init, timeoutMs, MAX_PROVIDER_RESPONSE_BYTES)

    if (!provider.response.ok) {
      if (provider.response.status === 429) throw new RouteError(503, 'AI analysis is temporarily rate-limited. Please try again later.')
      if (provider.response.status >= 500) throw new RouteError(503, 'AI analysis is temporarily unavailable. Please try again.')
      throw new RouteError(502, 'The AI provider could not complete this analysis.')
    }

    let providerPayload: unknown
    try {
      providerPayload = JSON.parse(provider.text)
    } catch {
      throw new RouteError(502, 'The AI provider returned an invalid response.')
    }
    if (!isRecord(providerPayload)) throw new RouteError(502, 'The AI provider returned an invalid response.')
    const candidates = providerPayload.candidates
    if (!Array.isArray(candidates) || !isRecord(candidates[0])) throw new RouteError(502, 'The AI provider returned no usable analysis.')
    const candidate = candidates[0]
    if (candidate.finishReason && candidate.finishReason !== 'STOP') throw new RouteError(502, 'The AI provider did not complete the analysis.')
    if (!isRecord(candidate.content) || !Array.isArray(candidate.content.parts)) throw new RouteError(502, 'The AI provider returned no usable analysis.')
    const responseText = candidate.content.parts
      .filter((part): part is Record<string, unknown> => isRecord(part) && typeof part.text === 'string')
      .map((part) => part.text as string)
      .join('')
    if (!responseText) throw new RouteError(502, 'The AI provider returned no usable analysis.')

    let candidatePacket: unknown
    try {
      candidatePacket = JSON.parse(responseText)
    } catch {
      throw new RouteError(502, 'The AI provider returned malformed analysis JSON.')
    }

    let analysis
    try {
      analysis = validateRoofAIObservationPacket(candidatePacket, preparedPhotos.length)
      rejectUnsafeClaims(analysis)
    } catch {
      throw new RouteError(502, 'The AI provider response did not satisfy the required observation contract.')
    }
    if (analysis.model_id !== MODEL_ID) throw new RouteError(502, 'The AI provider response did not identify the configured model.')
    if (!Array.isArray(analysis.image_audit) || analysis.image_audit.length !== preparedPhotos.length) throw new RouteError(502, 'The AI provider did not return one audit row for each photo. No finding was saved.')

    const { data: saved, error: saveError } = await supabase
      .from('photo_estimate_workflows')
      .update({
        ai_analysis: analysis,
        ai_analyzed_at: analysis.analyzed_at,
        ai_model_version: MODEL_ID,
        ai_content_hash: contentHash,
        updated_at: new Date().toISOString(),
      })
      .eq('id', workflowId)
      .eq('workspace_id', workspaceId)
      .select('id,ai_analysis,ai_analyzed_at,ai_model_version,ai_content_hash,updated_at')
      .maybeSingle()
    if (saveError || !saved) return jsonError('The AI analysis could not be saved to this workflow.', 502)

    return NextResponse.json({ workflowId, analysis: saved.ai_analysis, cached: false, contentHash })
  } catch (error) {
    if (error instanceof RouteError) return jsonError(error.message, error.status)
    return jsonError('AI analysis could not be completed. Please try again.', 500)
  }
}
