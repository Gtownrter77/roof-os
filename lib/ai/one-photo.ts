// One photo → estimate packet.
// Address from GPS, NOAA storm date, open aerial metadata, local code notes.
// Draft only. Tech verifies before any email or text.

export type OnePhotoInput = {
  address: string
  latitude: number | null
  longitude: number | null
  stormDate: string | null
  stormEvent: string | null
  aerialNote: string
  code: string
  codeNotes: string[]
  squares: number | null
}

export type OnePhotoPacket = {
  version: 'one-photo-v1'
  address: string
  storm: { date: string | null; event: string | null; source: 'NOAA/NWS' }
  aerial: { source: 'OpenAerialMap'; note: string; squares: number | null }
  codes: { reference: string; notes: string[] }
  estimate: {
    status: 'draft-for-tech'
    lines: Array<{ trade: string; note: string }>
    next: string
  }
  delivery: { email: string; sms: string; slaMinutes: 10 }
  requiresApproval: true
}

export function buildOnePhotoPacket(input: OnePhotoInput): OnePhotoPacket {
  const address = input.address || 'address not resolved'
  const stormLine = input.stormDate
    ? `NOAA/NWS candidate: ${input.stormEvent || 'storm'} on ${input.stormDate}.`
    : 'No NOAA storm candidate for this point.'
  return {
    version: 'one-photo-v1',
    address,
    storm: { date: input.stormDate, event: input.stormEvent, source: 'NOAA/NWS' },
    aerial: { source: 'OpenAerialMap', note: input.aerialNote, squares: input.squares },
    codes: { reference: input.code, notes: input.codeNotes },
    estimate: {
      status: 'draft-for-tech',
      lines: [
        { trade: 'roof', note: input.squares ? `Aerial draft ${input.squares} squares — confirm` : 'Squares not measured — confirm on site' },
        { trade: 'storm', note: stormLine },
        { trade: 'codes', note: input.code },
      ],
      next: 'Tech verifies quantities, then send.',
    },
    delivery: {
      email: `Hi, Guru Roofing drafted an inspection estimate for ${address}. A technician still needs to confirm it.`,
      sms: `Guru Roofing: draft estimate for ${address}. Tech will confirm before anything is final.`,
      slaMinutes: 10,
    },
    requiresApproval: true,
  }
}

export function readJpegGps(bytes: Uint8Array): { latitude: number; longitude: number } | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null
  let offset = 2
  while (offset + 4 < bytes.length) {
    if (bytes[offset] !== 0xff) break
    const marker = bytes[offset + 1]
    const size = (bytes[offset + 2] << 8) + bytes[offset + 3]
    if (marker === 0xe1 && size > 14) {
      const start = offset + 4
      const header = String.fromCharCode(...bytes.slice(start, start + 6))
      if (header.startsWith('Exif')) {
        const gps = parseExifGps(bytes, start + 6)
        if (gps) return gps
      }
    }
    if (size < 2) break
    offset += 2 + size
  }
  return null
}

function parseExifGps(bytes: Uint8Array, tiffStart: number): { latitude: number; longitude: number } | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const endian = view.getUint16(tiffStart) === 0x4949
  const read16 = (at: number) => view.getUint16(at, endian)
  const read32 = (at: number) => view.getUint32(at, endian)
  if (read16(tiffStart + 2) !== 42) return null
  let ifd = tiffStart + read32(tiffStart + 4)
  let gpsIfd = 0
  for (let guard = 0; guard < 8 && ifd; guard += 1) {
    const count = read16(ifd)
    for (let i = 0; i < count; i += 1) {
      const entry = ifd + 2 + i * 12
      if (read16(entry) === 0x8825) gpsIfd = tiffStart + read32(entry + 8)
    }
    const next = read32(ifd + 2 + count * 12)
    ifd = next ? tiffStart + next : 0
  }
  if (!gpsIfd) return null
  const count = read16(gpsIfd)
  const tags = new Map<number, { type: number; count: number; value: number }>()
  for (let i = 0; i < count; i += 1) {
    const entry = gpsIfd + 2 + i * 12
    tags.set(read16(entry), { type: read16(entry + 2), count: read32(entry + 4), value: read32(entry + 8) })
  }
  const lat = readRationalTriplet(view, endian, tiffStart, tags.get(2))
  const lon = readRationalTriplet(view, endian, tiffStart, tags.get(4))
  const latRef = readAscii(bytes, tiffStart, tags.get(1))
  const lonRef = readAscii(bytes, tiffStart, tags.get(3))
  if (lat === null || lon === null) return null
  return {
    latitude: latRef === 'S' ? -lat : lat,
    longitude: lonRef === 'W' ? -lon : lon,
  }
}

function readRationalTriplet(view: DataView, endian: boolean, tiffStart: number, tag?: { count: number; value: number }): number | null {
  if (!tag || tag.count < 3) return null
  const at = tiffStart + tag.value
  const parts = [0, 1, 2].map((i) => {
    const num = view.getUint32(at + i * 8, endian)
    const den = view.getUint32(at + i * 8 + 4, endian)
    return den ? num / den : 0
  })
  return parts[0] + parts[1] / 60 + parts[2] / 3600
}

function readAscii(bytes: Uint8Array, tiffStart: number, tag?: { value: number }): string {
  if (!tag) return ''
  const at = tiffStart + tag.value
  return String.fromCharCode(bytes[at] || 0)
}

export type AddressFilter = 'none' | 'bright' | 'contrast' | 'sharpen' | 'mono' | 'address'

export function chooseAddressFilter(width: number, height: number, bytes: number): AddressFilter {
  const pixels = width * height
  if (pixels < 800_000 || bytes < 80_000) return 'bright'
  if (pixels >= 2_000_000) return 'address'
  return 'contrast'
}

export const ADDRESS_FILTERS: AddressFilter[] = ['none', 'bright', 'contrast', 'sharpen', 'mono', 'address']
