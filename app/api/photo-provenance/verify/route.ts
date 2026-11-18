import { createHash } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '../../../../lib/supabase/admin'
import { createClient } from '../../../../lib/supabase/server'
import { getSupabaseEnv } from '../../../../lib/supabase/env'
import { isUuid, readJson } from '../../../../lib/api-security'
import { readEmbeddedGps } from '../../../../lib/photo-provenance.mjs'
import { fetchPrivatePhotoBytes } from '../../../../lib/photo-provenance-io'

export const runtime = 'nodejs'
const BUCKET = 'inspection-photos'
const MAX_BYTES = 30 * 1024 * 1024

function fail(error: string, status: number) { return NextResponse.json({ error }, { status }) }

export async function POST(request: NextRequest) {
  try {
    // Mobile uses its existing Supabase session bearer token; the website uses
    // a verified cookie session. Both require an authenticated user.
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
    const photoId = (parsed.body as { photoId?: unknown })?.photoId
    if (!isUuid(photoId)) return fail('A valid photo ID is required.', 400)

    const { data: photo, error: lookupError } = await admin.from('inspection_photos')
      .select('id,inspection_id,workspace_id,uploaded_by,bucket_id,object_path,mime_type,file_size_bytes')
      .eq('id', photoId).maybeSingle()
    if (lookupError) return fail('Photo metadata could not be verified.', 503)
    if (!photo) return fail('Photo not found.', 404)
    const { data: member, error: membershipError } = await admin.from('workspace_members')
      .select('role').eq('workspace_id', photo.workspace_id).eq('user_id', user.id).maybeSingle()
    if (membershipError) return fail('Workspace membership could not be verified.', 503)
    if (!member || photo.uploaded_by !== user.id) return fail('Photo verification is not authorized.', 403)
    if (photo.bucket_id !== BUCKET || !photo.object_path.startsWith(
      [photo.workspace_id, photo.uploaded_by, photo.inspection_id].join('/') + '/',
    )) return fail('Invalid private photo storage path.', 403)
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(photo.mime_type)) {
      return fail('Only JPEG, PNG, and WebP photo evidence is supported.', 415)
    }
    if (photo.file_size_bytes !== null && Number(photo.file_size_bytes) > MAX_BYTES) {
      return fail('The original photo exceeds 30 MB.', 413)
    }

    const { url } = getSupabaseEnv()
    const signed = await admin.storage.from(BUCKET).createSignedUrl(photo.object_path, 60)
    if (signed.error || !signed.data?.signedUrl) return fail('The private photo cannot be read.', 503)
    const signedUrl = new URL(signed.data.signedUrl, url)
    if (signedUrl.origin !== new URL(url).origin) return fail('Invalid private storage origin.', 403)
    const bytes = await fetchPrivatePhotoBytes(signedUrl, MAX_BYTES, 15_000)
    const gps = readEmbeddedGps(bytes)
    // GPS alone is not a reliable property ID. Require both embedded coordinates
    // and a non-empty embedded address to qualify for any photo automation.
    const valid = Boolean(gps && gps.address && gps.address.trim() && gps.address.length <= 250)
    const digest = createHash('sha256').update(bytes).digest('hex')
    const patch = valid
      ? {
          gps_verified: true,
          gps_latitude: gps.latitude,
          gps_longitude: gps.longitude,
          gps_address: gps.address,
          gps_verified_at: new Date().toISOString(),
          gps_sha256: digest,
        }
      : {
          gps_verified: false,
          gps_latitude: null,
          gps_longitude: null,
          gps_address: null,
          gps_verified_at: null,
          gps_sha256: null,
        }
    // Client roles cannot set these fields: DB trigger permits only server role.
    const { error: updateError } = await admin.from('inspection_photos').update(patch)
      .eq('id', photo.id).eq('workspace_id', photo.workspace_id)
    if (updateError) return fail('Photo provenance could not be recorded. Database migration may be missing.', 503)

    const { data: settings, error: settingsError } = await admin.from('workspace_settings')
      .select('enable_auto_photo_measurements').eq('workspace_id', photo.workspace_id).maybeSingle()
    // Absent/failed setting is OFF by design. Never infer permission from a request.
    return NextResponse.json({
      photoId: photo.id,
      gpsVerified: valid,
      latitude: valid ? gps.latitude : null,
      longitude: valid ? gps.longitude : null,
      embeddedAddress: valid ? gps.address : null,
      photoAutomationEligible: valid,
      autoMeasurementsAllowed: valid && !settingsError && settings?.enable_auto_photo_measurements === true,
      status: valid ? 'gps_verified' : 'manual_only',
      reason: valid ? null : 'Photo accepted for manual use only: embedded GPS coordinates and property address are required for automations.',
    })
  } catch {
    return fail('Photo GPS verification unavailable. This photo remains manual-only.', 503)
  }
}
