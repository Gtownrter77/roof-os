import { createHash } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createGeminiGenerateContentRequest } from '../../../../lib/ai/gemini-request.mjs'
import { GEOMETRY_CONTRACT_VERSION, validateGeometrySuggestion, GeometryContractValidationError } from '../../../../lib/ai/geometry-contract'
import { isUuid, readJson, requireWorkspaceMember } from '../../../../lib/api-security'
import { getSupabaseEnv } from '../../../../lib/supabase/env'
import { createClient } from '../../../../lib/supabase/server'
export const runtime = 'nodejs'
export const maxDuration = 120
const MODEL_ID = 'gemini-2.5-flash'
const MAX_IMAGE_BYTES = 30 * 1024 * 1024
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024
const PHOTO_BUCKET = 'inspection-photos'
class RouteError extends Error { constructor(readonly status: number, message: string) { super(message) } }
function jsonError(message: string, status: number) { return NextResponse.json({ error: message }, { status }) }
function record(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === 'object' && !Array.isArray(value) }
async function boundedBytes(response: Response, maxBytes: number) {
  if (!response.body) throw new RouteError(502, 'The selected image could not be read.')
  const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let size = 0
  try { while (true) { const next = await reader.read(); if (next.done) break; size += next.value.byteLength; if (size > maxBytes) throw new RouteError(413, 'The selected image exceeds the 30 MB limit.'); chunks.push(next.value) } } finally { reader.releaseLock() }
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)), size)
}
async function fetchBounded(url: string, timeoutMs: number, maxBytes: number) {
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), timeoutMs)
  try { const response = await fetch(url, { signal: controller.signal, cache: 'no-store' }); if (!response.ok) throw new RouteError(502, 'The selected image could not be retrieved from private storage.'); return await boundedBytes(response, maxBytes) }
  catch (error) { if (error instanceof RouteError) throw error; if (controller.signal.aborted) throw new RouteError(504, 'Aerial analysis timed out.'); throw new RouteError(502, 'The selected image could not be retrieved.') }
  finally { clearTimeout(timer) }
}
async function providerText(url: string, init: RequestInit) {
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 90_000)
  try { const response = await fetch(url, { ...init, signal: controller.signal, cache: 'no-store' }); const bytes = await boundedBytes(response, MAX_RESPONSE_BYTES); return { response, text: bytes.toString('utf8') } }
  catch (error) { if (error instanceof RouteError) throw error; if (controller.signal.aborted) throw new RouteError(504, 'AI analysis timed out.'); throw new RouteError(503, 'AI analysis is temporarily unavailable.') }
  finally { clearTimeout(timer) }
}
function isImage(bytes: Buffer) { return (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) || bytes.subarray(0, 8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a])) || (bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') }
const SYSTEM_PROMPT = `Analyze the supplied actual roof image as an assistant only. Return exactly one JSON object matching ROOF/OS geometry contract ${GEOMETRY_CONTRACT_VERSION}. Coordinates must be pixels in the supplied image. Suggest roof planes as non-self-intersecting polygons, roof edges with classifications eave/rake/ridge/hip/valley/transition/step_flashing/other, and roof objects with types skylight/chimney/hvac/pipe_boot/attic_vent/other. Use low/medium/high confidence as a qualitative label, not a calibrated probability. Do not invent scale, feet, square feet, roofing squares, linear feet, quantities, or confirmed measurements. If the roof is not clearly visible, return empty arrays and a warning. No Markdown or extra keys.`
async function getContext() { const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser(); if (!user) return { supabase, response: jsonError('Authentication required.', 401) }; const { data: workspaceId, error } = await supabase.rpc('current_workspace_id'); if (error || !isUuid(workspaceId)) return { supabase, response: jsonError('An active workspace is required.', 403) }; const membership = await requireWorkspaceMember(supabase, user.id, workspaceId); if (membership.response) return { supabase, response: membership.response }; return { supabase, user, workspaceId } }
export async function POST(request: NextRequest) {
  try {
    const context = await getContext(); if ('response' in context) return context.response
    const parsed = await readJson(request, 16 * 1024); if ('error' in parsed) return jsonError(parsed.error, parsed.status)
    const body = parsed.body as { photoId?: unknown; inspectionId?: unknown; imageWidth?: unknown; imageHeight?: unknown; address?: unknown }
    const { photoId, inspectionId, imageWidth, imageHeight } = body
    const width = Number(imageWidth); const height = Number(imageHeight)
    if (!isUuid(photoId) || !isUuid(inspectionId)) return jsonError('photoId and inspectionId must be valid UUIDs.', 400)
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 100000 || height > 100000) return jsonError('Valid image dimensions are required.', 400)
    const { supabase, user, workspaceId } = context
    const { data: photo, error: photoError } = await supabase.from('inspection_photos').select('id,workspace_id,inspection_id,uploaded_by,bucket_id,object_path,mime_type,file_size_bytes,upload_status').eq('id', photoId).eq('workspace_id', workspaceId).eq('inspection_id', inspectionId).maybeSingle()
    if (photoError) return jsonError('Photo access could not be verified.', 503)
    if (!photo || photo.bucket_id !== PHOTO_BUCKET || photo.upload_status !== 'uploaded') return jsonError('The selected image is not available in this workspace.', 403)
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(photo.mime_type) || !/^[0-9a-f-]+\/(?:[0-9a-f-]+)\/(?:[0-9a-f-]+)\/[0-9a-f-]+\.(?:jpe?g|png|webp)$/i.test(photo.object_path)) return jsonError('Only authorized JPEG, PNG, and WebP inspection images are supported.', 415)
    const { url: supabaseUrl } = getSupabaseEnv(); const signed = await supabase.storage.from(PHOTO_BUCKET).createSignedUrl(photo.object_path, 60); if (signed.error || !signed.data?.signedUrl) throw new RouteError(502, 'The selected image could not be signed for analysis.')
    const signedUrl = new URL(signed.data.signedUrl, new URL(supabaseUrl).origin); if (signedUrl.origin !== new URL(supabaseUrl).origin) throw new RouteError(502, 'The selected image URL is not private storage.')
    const bytes = await fetchBounded(signedUrl.toString(), 15_000, MAX_IMAGE_BYTES); if (!bytes.length || !isImage(bytes)) return jsonError('The selected image failed image validation.', 415)
    const contentHash = createHash('sha256').update(bytes).digest('hex')
    const { data: existing } = await supabase.from('aerial_measurements').select('id,status,calibration_status,source_photo_id,image_width,image_height').eq('workspace_id', workspaceId).eq('source_photo_id', photoId).maybeSingle()
    if (existing) {
      const [planes, edges, objects] = await Promise.all([
        supabase.from('roof_planes').select('id,vertices,suggested_pitch,confidence,review_status').eq('aerial_measurement_id', existing.id).eq('workspace_id', workspaceId),
        supabase.from('roof_edges').select('id,start_point,end_point,classification,confidence,review_status').eq('aerial_measurement_id', existing.id).eq('workspace_id', workspaceId),
        supabase.from('roof_objects').select('id,object_type,position,confidence,review_status').eq('aerial_measurement_id', existing.id).eq('workspace_id', workspaceId),
      ])
      if ((planes.data?.length ?? 0) || (edges.data?.length ?? 0) || (objects.data?.length ?? 0)) {
        return NextResponse.json({ measurement: existing, suggestion: { contract_version: GEOMETRY_CONTRACT_VERSION, image_width: existing.image_width, image_height: existing.image_height, source_image_reference: 'persisted-review-suggestions', planes: (planes.data ?? []).map((row) => ({ id: row.id, dbId: row.id, vertices: row.vertices, suggested_pitch: row.suggested_pitch, confidence: row.confidence, review_status: row.review_status })), edges: (edges.data ?? []).map((row) => ({ id: row.id, dbId: row.id, start: row.start_point, end: row.end_point, classification: row.classification, confidence: row.confidence, review_status: row.review_status })), objects: (objects.data ?? []).map((row) => ({ id: row.id, dbId: row.id, type: row.object_type, position: row.position, confidence: row.confidence, review_status: row.review_status })), warnings: ['Persisted suggestions loaded; no existing geometry was overwritten.'] }, cached: true, warning: 'Existing suggestions were preserved. Use the review controls to accept, reject, or edit them.' })
      }
    }
    const apiKey = process.env.GEMINI_API_KEY?.trim()
    if (!apiKey) return jsonError('AI image analysis is not configured on this server. Manual measurement remains available.', 503)
    const measurement = existing ?? (await supabase.from('aerial_measurements').insert({ workspace_id: workspaceId, inspection_id: inspectionId, source_photo_id: photoId, image_width: width, image_height: height, status: 'draft', created_by: user.id }).select('id,status,calibration_status,source_photo_id').single()).data
    if (!measurement) return jsonError('Could not create the aerial measurement workspace.', 502)
    const payload = { contents: [{ role: 'user', parts: [{ text: SYSTEM_PROMPT }, { inline_data: { mime_type: photo.mime_type, data: bytes.toString('base64') } }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0.1, maxOutputTokens: 8192 } }
    const providerRequest = createGeminiGenerateContentRequest(MODEL_ID, apiKey, payload); const provider = await providerText(providerRequest.url, providerRequest.init)
    if (!provider.response.ok) throw new RouteError(provider.response.status === 429 ? 503 : 502, 'The configured AI provider could not complete this analysis.')
    let outer: unknown; try { outer = JSON.parse(provider.text) } catch { throw new RouteError(502, 'The AI provider returned malformed JSON.') }
    if (!record(outer) || !Array.isArray(outer.candidates) || !record(outer.candidates[0]) || !record(outer.candidates[0].content) || !Array.isArray(outer.candidates[0].content.parts)) throw new RouteError(502, 'The AI provider returned no usable geometry.')
    const text = outer.candidates[0].content.parts.filter((part: unknown): part is Record<string, unknown> => record(part) && typeof part.text === 'string').map((part) => part.text as string).join('')
    let suggestion: unknown; try { suggestion = JSON.parse(text) } catch { throw new RouteError(502, 'The AI provider returned malformed geometry JSON.') }
    let validated; try { validated = validateGeometrySuggestion(suggestion) } catch (error) { if (error instanceof GeometryContractValidationError) throw new RouteError(502, 'The AI provider returned invalid geometry.'); throw error }
    if (validated.image_width !== width || validated.image_height !== height) throw new RouteError(502, 'The AI provider returned mismatched image dimensions.')
    const sourceReference = `inspection-photo:${photoId}:sha256:${contentHash}`
    const planeRows = validated.planes.map((plane) => ({ aerial_measurement_id: measurement.id, workspace_id: workspaceId, vertices: plane.vertices, suggested_pitch: plane.suggested_pitch, confidence: plane.confidence, source_image_reference: sourceReference, is_suggested: true, created_by: user.id }))
    const edgeRows = validated.edges.map((edge) => ({ aerial_measurement_id: measurement.id, workspace_id: workspaceId, start_point: edge.start, end_point: edge.end, classification: edge.classification, confidence: edge.confidence, source_image_reference: sourceReference, is_suggested: true, created_by: user.id }))
    const objectRows = validated.objects.map((object) => ({ aerial_measurement_id: measurement.id, workspace_id: workspaceId, object_type: object.type, position: object.position, confidence: object.confidence, source_image_reference: sourceReference, is_suggested: true, created_by: user.id }))
    let savedPlanes: Array<{ id: string; review_status: string }> = []
    let savedEdges: Array<{ id: string; review_status: string }> = []
    let savedObjects: Array<{ id: string; review_status: string }> = []
    if (planeRows.length) { const { data, error } = await supabase.from('roof_planes').insert(planeRows).select('id,review_status'); if (error) throw new RouteError(502, 'AI suggestions could not be saved.'); savedPlanes = data ?? [] }
    if (edgeRows.length) { const { data, error } = await supabase.from('roof_edges').insert(edgeRows).select('id,review_status'); if (error) throw new RouteError(502, 'AI suggestions could not be saved.'); savedEdges = data ?? [] }
    if (objectRows.length) { const { data, error } = await supabase.from('roof_objects').insert(objectRows).select('id,review_status'); if (error) throw new RouteError(502, 'AI suggestions could not be saved.'); savedObjects = data ?? [] }
    const persistedSuggestion = { ...validated, planes: validated.planes.map((item, index) => ({ ...item, dbId: savedPlanes[index]?.id, review_status: savedPlanes[index]?.review_status ?? 'pending' })), edges: validated.edges.map((item, index) => ({ ...item, dbId: savedEdges[index]?.id, review_status: savedEdges[index]?.review_status ?? 'pending' })), objects: validated.objects.map((item, index) => ({ ...item, dbId: savedObjects[index]?.id, review_status: savedObjects[index]?.review_status ?? 'pending' })) }
    return NextResponse.json({ measurement, suggestion: persistedSuggestion, model: MODEL_ID, cached: false, warning: 'AI suggestions are image-coordinate observations only. Calibrate and confirm manually before any authoritative quantity or estimate handoff.' }, { status: 201 })
  } catch (error) { if (error instanceof RouteError) return jsonError(error.message, error.status); return jsonError('Aerial AI analysis could not be completed.', 500) }
}
export async function PATCH(request: NextRequest) {
  const context = await getContext(); if ('response' in context) return context.response
  const parsed = await readJson(request, 16 * 1024); if ('error' in parsed) return jsonError(parsed.error, parsed.status)
  const { supabase, user, workspaceId } = context; const body = parsed.body as { action?: unknown; aerialMeasurementId?: unknown; scaleReferencePixels?: unknown; scaleReferenceFeet?: unknown; suggestionId?: unknown; kind?: unknown; vertices?: unknown; imageWidth?: unknown; imageHeight?: unknown; classification?: unknown; pitch?: unknown }; const action = typeof body.action === 'string' ? body.action : ''
  if (!['accept','reject','edit','delete','calibrate','confirm'].includes(action)) return jsonError('Unsupported review action.', 400)
  if (!isUuid(body.aerialMeasurementId)) return jsonError('aerialMeasurementId must be a valid UUID.', 400)
  const { data: measurement } = await supabase.from('aerial_measurements').select('id,workspace_id,status,calibration_status').eq('id', body.aerialMeasurementId).eq('workspace_id', workspaceId).maybeSingle()
  if (!measurement) return jsonError('Aerial measurement not found in this workspace.', 404)
  if (action === 'calibrate') { if (measurement.status === 'confirmed') return jsonError('Confirmed geometry is immutable; start a new review if a correction is required.', 409); if (!(Number(body.scaleReferencePixels) > 0) || !(Number(body.scaleReferenceFeet) > 0)) return jsonError('A positive human scale reference is required for calibration.', 400); const { data, error } = await supabase.from('aerial_measurements').update({ calibration_status: 'calibrated' }).eq('id', measurement.id).eq('workspace_id', workspaceId).select('id,calibration_status').single(); if (error) return jsonError('Calibration could not be saved.', 502); return NextResponse.json({ measurement: data, warning: 'Calibration enables review but does not turn AI suggestions into authoritative quantities.' }) }
  if (action === 'confirm') { if (measurement.calibration_status !== 'calibrated') return jsonError('Calibrate the image before confirming geometry.', 400); const pendingResults = await Promise.all([supabase.from('roof_planes').select('id').eq('aerial_measurement_id', measurement.id).eq('review_status', 'pending').limit(1), supabase.from('roof_edges').select('id').eq('aerial_measurement_id', measurement.id).eq('review_status', 'pending').limit(1), supabase.from('roof_objects').select('id').eq('aerial_measurement_id', measurement.id).eq('review_status', 'pending').limit(1)]); if (pendingResults.some((result) => (result.data ?? []).length > 0)) return jsonError('Review every AI suggestion before confirming geometry.', 400); const { data, error } = await supabase.from('aerial_measurements').update({ status: 'confirmed', calibration_status: 'confirmed', confirmed_by: user.id, confirmed_at: new Date().toISOString() }).eq('id', measurement.id).eq('workspace_id', workspaceId).select('id,calibration_status,confirmed_by,confirmed_at').single(); if (error) return jsonError('Geometry confirmation could not be saved.', 502); return NextResponse.json({ measurement: data, warning: 'Only confirmed geometry may proceed to authoritative server-side calculations; AI never creates estimate quantities.' }) }
  if (!isUuid(body.suggestionId)) return jsonError('suggestionId must be a valid UUID.', 400)
  const table = body.kind === 'plane' ? 'roof_planes' : body.kind === 'edge' ? 'roof_edges' : body.kind === 'object' ? 'roof_objects' : null
  if (!table) return jsonError('kind must be plane, edge, or object.', 400)
  if (measurement.calibration_status === 'confirmed') return jsonError('Confirmed geometry is immutable; start a new review if a correction is required.', 409)
  const update: Record<string, unknown> = { reviewed_by: user.id, reviewed_at: new Date().toISOString(), review_status: action === 'accept' ? 'accepted' : action === 'reject' ? 'rejected' : 'edited' }
  if (action === 'delete') update.review_status = 'rejected'
  if (action === 'edit') { if (body.vertices) { try { update.vertices = validateGeometrySuggestion({ contract_version: GEOMETRY_CONTRACT_VERSION, image_width: body.imageWidth, image_height: body.imageHeight, source_image_reference: 'manual-edit', planes: [{ id: 'edit', vertices: body.vertices, suggested_pitch: null, confidence: 'low' }], edges: [], objects: [], warnings: [] }).planes[0].vertices } catch { return jsonError('Edited vertices are invalid or self-intersecting.', 400) } } if (body.classification) update.classification = body.classification; if (body.pitch !== undefined) update.suggested_pitch = typeof body.pitch === 'string' ? body.pitch.slice(0, 80) : null }
  const { data, error } = await supabase.from(table).update(update).eq('id', body.suggestionId).eq('aerial_measurement_id', measurement.id).eq('workspace_id', workspaceId).select('id,review_status,reviewed_by,reviewed_at').single()
  if (error || !data) return jsonError('Suggestion could not be updated.', 502)
  return NextResponse.json({ suggestion: data, warning: 'Reviewed geometry remains separate from calibration and authoritative measurement calculations.' })
}
