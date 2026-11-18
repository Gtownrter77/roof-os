import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '../../../lib/supabase/admin'
import { createClient } from '../../../lib/supabase/server'
import { isUuid, readJson } from '../../../lib/api-security'
import { getSupabaseEnv } from '../../../lib/supabase/env'
import { fetchPrivatePhotoBytes } from '../../../lib/photo-provenance-io'
import { isCertifiedPhotoContent } from '../../../lib/photo-provenance-integrity.mjs'

export const runtime = 'nodejs'
function error(message: string, status: number) { return NextResponse.json({ error: message }, { status }) }

// First step behind the one-photo field workflow: create a reviewable,
// idempotent property evidence packet; never fabricate aerial roof geometry,
// quantities, damage, insurance coverage, code findings or prices.
export async function POST(request: NextRequest) {
  try {
    const admin = createAdminClient()
    const bearer = request.headers.get('authorization') ?? ''
    let user
    if (/^Bearer\s+/i.test(bearer)) {
      const identity = await admin.auth.getUser(bearer.replace(/^Bearer\s+/i, '').trim())
      user = identity.error ? null : identity.data.user
    } else {
      const supabase = await createClient()
      const identity = await supabase.auth.getUser()
      user = identity.error ? null : identity.data.user
    }
    if (!user) return error('Authentication required.', 401)
    const parsed = await readJson(request, 4096)
    if ('error' in parsed) return error(parsed.error, parsed.status)
    const photoId = (parsed.body as { photoId?: unknown })?.photoId
    if (!isUuid(photoId)) return error('Valid photo ID required.', 400)

    const { data: photo, error: photoError } = await admin.from('inspection_photos')
      .select('id,inspection_id,workspace_id,uploaded_by,gps_verified,gps_latitude,gps_longitude,gps_address,gps_sha256,bucket_id,object_path,upload_status')
      .eq('id', photoId).maybeSingle()
    if (photoError) return error('Photo access could not be verified.', 503)
    if (!photo) return error('Photo not found.', 404)
    const { data: membership } = await admin.from('workspace_members').select('role')
      .eq('workspace_id', photo.workspace_id).eq('user_id', user.id).maybeSingle()
    if (!membership || photo.uploaded_by !== user.id) return error('Not authorized for this photo.', 403)
    if (!photo.gps_verified || !photo.gps_address?.trim()
        || !Number.isFinite(photo.gps_latitude) || !Number.isFinite(photo.gps_longitude)
        || photo.upload_status !== 'uploaded') {
      return NextResponse.json({ accepted: true, automationStarted: false, status: 'manual_only',
        reason: 'Missing server-verified GPS coordinates and address embedded in the photo.' })
    }
    const { data: settings, error: settingError } = await admin.from('workspace_settings')
      .select('enable_auto_photo_measurements').eq('workspace_id', photo.workspace_id).maybeSingle()
    if (settingError || settings?.enable_auto_photo_measurements !== true) {
      return NextResponse.json({ accepted: true, automationStarted: false, status: 'owner_permission_required',
        reason: 'Automatic photo measurements are OFF until workspace owner approval.' })
    }

    // Recheck the bytes at the time of automation; a database GPS flag alone
    // cannot prove the stored image has not since been overwritten.
    const expectedPrefix = [photo.workspace_id, photo.uploaded_by, photo.inspection_id].join('/') + '/'
    if (photo.bucket_id !== 'inspection-photos' || !photo.object_path.startsWith(expectedPrefix)) {
      return error('Photo storage provenance does not match its inspection.', 403)
    }
    const signed = await admin.storage.from('inspection-photos').createSignedUrl(photo.object_path, 60)
    if (signed.error || !signed.data?.signedUrl) return error('The original photo is unavailable for verification.', 503)
    const { url: supabaseUrl } = getSupabaseEnv()
    const signedUrl = new URL(signed.data.signedUrl, supabaseUrl)
    if (signedUrl.origin !== new URL(supabaseUrl).origin) return error('Invalid private photo source.', 403)
    const originalBytes = await fetchPrivatePhotoBytes(signedUrl, 30 * 1024 * 1024, 15_000)
    if (!isCertifiedPhotoContent(photo, originalBytes)) {
      return error('Original photo no longer matches its embedded GPS certification. No automation started.', 403)
    }

    const { data: inspection } = await admin.from('inspection_sessions').select('id,workspace_id,lead_id')
      .eq('id', photo.inspection_id).eq('workspace_id', photo.workspace_id).maybeSingle()
    if (!inspection) return error('Inspection and photo workspace do not match.', 403)

    const reviewItems = [
      'Verify the GPS-tagged photograph belongs to the intended property',
      'Match the candidate address and GPS coordinates to the job and building',
      'Find licensed/open aerial imagery; flag unavailable coverage',
      'Review actual roof planes, scale, pitch and edge classifications',
      'Verify measurements and source photography',
      'Review observed damage with uncertainty and code/storm evidence',
      'Apply owner-approved prices and quantities; no invented values',
      'Collect technician and manager approval before a customer-ready report',
    ]
    const report = {
      title: 'BAILEY BOSS Photo-to-Report — Property Review',
      status: 'needs_review',
      address: photo.gps_address,
      sourceEvidence: { inspectionId: inspection.id, photoIds: [photo.id], photoCount: 1 },
      gps: { latitude: photo.gps_latitude, longitude: photo.gps_longitude,
        source: 'verified EXIF embedded in original photograph', propertyMatch: 'unverified' },
      propertyEvidence: { status: 'needs_property_match', imagery: 'unavailable_until_verified',
        roofGeometry: 'unverified', roofAreaSqFt: null },
      damageEvidence: { status: 'not_analyzed', findings: [] },
      requiredReview: reviewItems,
      disclaimer: 'GPS proves photo coordinates are embedded, not that a particular property or roof was conclusively identified. No estimates or damage claims are approved.',
    }
    const estimate = { status: 'unpriced_review', lineItems: [], roofSquares: null,
      gutterLf: null, total: null, reason: 'Certified geometry, measured pitch and approved price book not yet available.' }
    // Single database transaction ensures concurrent requests and retries
    // cannot create duplicate or orphaned workflow packets.
    const { data: reviewPacketId, error: packetError } = await admin.rpc(
      'start_photo_to_report_review_packet',
      { p_workspace_id: photo.workspace_id, p_photo_id: photo.id, p_actor_id: user.id,
        p_report: report, p_estimate: estimate },
    )
    if (packetError || !reviewPacketId) return error(
      'The Photo-to-Report packet could not be committed. Safe to retry; no estimate was approved.', 503,
    )
    return NextResponse.json({ accepted: true, automationStarted: true,
      status: 'property_review', reviewPacketId,
      message: 'Evidence packet created or reused. Property and measurements still require review; no report was released.' })
  } catch {
    return error('Photo-to-report automation unavailable. Manual inspection remains available.', 503)
  }
}
