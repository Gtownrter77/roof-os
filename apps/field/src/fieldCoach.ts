export type PhotoAlbum = 'general' | 'before' | 'damage' | 'measurements' | 'completed'

export type GeocodedPlace = {
  streetNumber?: string | null
  street?: string | null
  name?: string | null
  city?: string | null
  region?: string | null
  postalCode?: string | null
}

export type CoachSnapshot = {
  address: string
  hasPoint: boolean
  photoCount: number
  hasMeasurements: boolean
  notes: string
  synced: boolean
  pendingUploads: number
}

export type CoachItem = {
  id: 'property' | 'elevations' | 'notes' | 'upload'
  done: boolean
  label: string
  hint: string
}

const CAPTIONS: Record<PhotoAlbum, string> = {
  general: 'Street overview of the property',
  before: 'Existing roof before any work',
  damage: 'Visible storm damage on the roof',
  measurements: 'Reference photo for the measurements',
  completed: 'Completed roof after the work',
}

export function suggestCaption(album: PhotoAlbum) {
  return CAPTIONS[album]
}

export function suggestAlbum(caption: string): PhotoAlbum | null {
  const text = caption.toLowerCase()
  if (!text.trim()) return null
  if (/damage|hail|missing|creased|lifted|bruise/.test(text)) return 'damage'
  if (/measure|pitch|eave|square/.test(text)) return 'measurements'
  if (/before|existing|original/.test(text)) return 'before'
  if (/complete|after|finished|new roof/.test(text)) return 'completed'
  if (/street|overview|front/.test(text)) return 'general'
  return null
}

export function formatGeocodedAddress(place?: GeocodedPlace | null) {
  if (!place) return ''
  const street = [place.streetNumber, place.street].filter(Boolean).join(' ')
  const line = street || place.name || ''
  return [line, place.city, place.region, place.postalCode].filter(Boolean).join(', ')
}

export function fieldCoach(snapshot: CoachSnapshot): CoachItem[] {
  const property = Boolean(snapshot.address.trim() && snapshot.hasPoint)
  const elevations = snapshot.photoCount > 0
  const notes = Boolean(snapshot.notes.trim() || snapshot.hasMeasurements)
  const upload = snapshot.synced && snapshot.pendingUploads === 0 && snapshot.photoCount > 0
  return [
    {
      id: 'property',
      done: property,
      label: 'Confirm customer and property',
      hint: property ? 'Address and GPS are on this draft.' : 'Capture GPS or pick the lead so the address is on the draft.',
    },
    {
      id: 'elevations',
      done: elevations,
      label: 'Capture roof elevations and damage',
      hint: elevations ? `${snapshot.photoCount} photo${snapshot.photoCount === 1 ? '' : 's'} queued.` : 'Take at least one photo. Damage album is the one the office looks for first.',
    },
    {
      id: 'notes',
      done: notes,
      label: 'Add notes and next action',
      hint: notes ? 'Measurements or notes are on the draft.' : 'Save the measurement set or a verification note.',
    },
    {
      id: 'upload',
      done: upload,
      label: 'Upload when online',
      hint: upload ? 'This draft is synced.' : snapshot.pendingUploads > 0 ? `${snapshot.pendingUploads} item${snapshot.pendingUploads === 1 ? '' : 's'} still waiting to upload.` : 'Sync after the photos and measurements are saved.',
    },
  ]
}

export function measurementNotes(input: {
  squares: number
  gutter: number
  eave: number
  pitch: number
}) {
  const notes: string[] = []
  if (!Number.isFinite(input.squares) || !Number.isFinite(input.pitch)) return notes
  if (input.pitch >= 10 && input.pitch <= 24) {
    notes.push('Pitch is 10/12 or steeper. Plan a steep adder and extra tie-off.')
  }
  if (input.squares > 80) {
    notes.push('Over 80 squares. Confirm that number is one structure.')
  }
  if (input.eave > 0 && input.gutter > input.eave * 1.4) {
    notes.push('Gutter feet are well above eave feet. Confirm before this becomes an estimate.')
  }
  return notes
}

export function draftNeedsSync(input: {
  remoteId: string | null
  verifiedAt: string | null
  technicianName: string | null
  verificationSynced: boolean
  pendingRows: number
}) {
  if (!input.remoteId) return true
  if (input.pendingRows > 0) return true
  if (input.verifiedAt && input.technicianName && !input.verificationSynced) return true
  return false
}

export async function activeAlertHeadline(latitude: number, longitude: number, timeoutMs = 8000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(
      `https://api.weather.gov/alerts/active?point=${latitude},${longitude}`,
      {
        headers: {
          Accept: 'application/geo+json',
          'User-Agent': 'ROOF-OS-Field/1.0 (field-coach)',
        },
        signal: controller.signal,
      },
    )
    if (!response.ok) return null
    const body = (await response.json()) as {
      features?: Array<{ properties?: { event?: string; severity?: string } }>
    }
    const props = body.features?.[0]?.properties
    if (!props?.event) return null
    return props.severity ? `${props.event} · ${props.severity}` : props.event
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}
