import { createHash } from 'node:crypto'
import { readEmbeddedGps } from './photo-provenance.mjs'

// Reject stale certifications if a private storage object has been replaced,
// even when its database row was once certified. Metadata alone is not proof.
export function isCertifiedPhotoContent(photo, input) {
  if (!photo || photo.gps_verified !== true || !/^[a-f0-9]{64}$/.test(photo.gps_sha256 ?? '')) return false
  if (typeof photo.gps_address !== 'string' || !photo.gps_address.trim()) return false
  if (!Number.isFinite(photo.gps_latitude) || !Number.isFinite(photo.gps_longitude)) return false
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input)
  if (!bytes.length) return false
  const digest = createHash('sha256').update(bytes).digest('hex')
  if (digest !== photo.gps_sha256) return false
  const gps = readEmbeddedGps(bytes)
  return Boolean(gps && gps.address === photo.gps_address
    && Math.abs(gps.latitude - photo.gps_latitude) < 0.00001
    && Math.abs(gps.longitude - photo.gps_longitude) < 0.00001)
}
