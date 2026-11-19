// JPEG GPS EXIF. A photo is accepted only when location is embedded in the file.

export type EmbeddedLocation = { latitude: number; longitude: number }

const EXIF_HEADER = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00]

function u16(bytes: Uint8Array, offset: number, le: boolean) {
  return le ? bytes[offset] | (bytes[offset + 1] << 8) : (bytes[offset] << 8) | bytes[offset + 1]
}
function u32(bytes: Uint8Array, offset: number, le: boolean) {
  return le
    ? (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0
    : ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0
}

function rational(bytes: Uint8Array, offset: number, le: boolean) {
  const num = u32(bytes, offset, le)
  const den = u32(bytes, offset + 4, le)
  return den ? num / den : 0
}

function toDms(value: number) {
  const abs = Math.abs(value)
  const deg = Math.floor(abs)
  const minFloat = (abs - deg) * 60
  const min = Math.floor(minFloat)
  const sec = Math.round((minFloat - min) * 60 * 10000)
  return { deg, min, sec }
}

function readGps(bytes: Uint8Array): EmbeddedLocation | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null
  let offset = 2
  while (offset + 4 < bytes.length) {
    if (bytes[offset] !== 0xff) break
    const marker = bytes[offset + 1]
    if (marker === 0xda) break
    const size = u16(bytes, offset + 2, false)
    if (marker === 0xe1 && size > 8) {
      const start = offset + 4
      if (EXIF_HEADER.every((b, i) => bytes[start + i] === b)) {
        const found = readExifGps(bytes.subarray(start + 6, start + size - 2))
        if (found) return found
      }
    }
    offset += 2 + size
  }
  return null
}

function readExifGps(tiff: Uint8Array): EmbeddedLocation | null {
  if (tiff.length < 8) return null
  const le = tiff[0] === 0x49 && tiff[1] === 0x49
  if (!le && !(tiff[0] === 0x4d && tiff[1] === 0x4d)) return null
  const ifd0 = u32(tiff, 4, le)
  if (ifd0 + 2 > tiff.length) return null
  const count = u16(tiff, ifd0, le)
  let gpsOffset = 0
  for (let i = 0; i < count; i += 1) {
    const entry = ifd0 + 2 + i * 12
    if (entry + 12 > tiff.length) break
    if (u16(tiff, entry, le) === 0x8825) gpsOffset = u32(tiff, entry + 8, le)
  }
  if (!gpsOffset || gpsOffset + 2 > tiff.length) return null
  const gpsCount = u16(tiff, gpsOffset, le)
  let lat: number | null = null
  let lon: number | null = null
  let latRef = 'N'
  let lonRef = 'E'
  for (let i = 0; i < gpsCount; i += 1) {
    const entry = gpsOffset + 2 + i * 12
    if (entry + 12 > tiff.length) break
    const tag = u16(tiff, entry, le)
    const type = u16(tiff, entry + 2, le)
    const valueOffset = u32(tiff, entry + 8, le)
    if (tag === 1 && type === 2) latRef = String.fromCharCode(tiff[entry + 8])
    if (tag === 3 && type === 2) lonRef = String.fromCharCode(tiff[entry + 8])
    if ((tag === 2 || tag === 4) && type === 5 && valueOffset + 24 <= tiff.length) {
      const d = rational(tiff, valueOffset, le)
      const m = rational(tiff, valueOffset + 8, le)
      const s = rational(tiff, valueOffset + 16, le)
      const decimal = d + m / 60 + s / 3600
      if (tag === 2) lat = decimal
      if (tag === 4) lon = decimal
    }
  }
  if (lat == null || lon == null) return null
  return { latitude: latRef === 'S' ? -lat : lat, longitude: lonRef === 'W' ? -lon : lon }
}

function writeU16(target: number[], value: number) {
  target.push(value & 0xff, (value >> 8) & 0xff)
}
function writeU32(target: number[], value: number) {
  target.push(value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff, (value >>> 24) & 0xff)
}

function buildGpsExif(latitude: number, longitude: number) {
  const lat = toDms(latitude)
  const lon = toDms(longitude)
  const tiff: number[] = [0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00]
  writeU16(tiff, 1)
  writeU16(tiff, 0x8825)
  writeU16(tiff, 4)
  writeU32(tiff, 1)
  writeU32(tiff, 26)
  writeU32(tiff, 0)
  writeU16(tiff, 5)
  const gps: number[] = []
  const dataStart = 26 + 2 + 5 * 12 + 4
  const pushEntry = (tag: number, type: number, count: number, value: number) => {
    writeU16(gps, tag); writeU16(gps, type); writeU32(gps, count); writeU32(gps, value)
  }
  pushEntry(1, 2, 2, latitude < 0 ? 0x0053 : 0x004e)
  pushEntry(2, 5, 3, dataStart)
  pushEntry(3, 2, 2, longitude < 0 ? 0x0057 : 0x0045)
  pushEntry(4, 5, 3, dataStart + 24)
  pushEntry(0x12, 2, 7, dataStart + 48)
  writeU32(gps, 0)
  const dms = (parts: { deg: number; min: number; sec: number }) => {
    writeU32(gps, parts.deg); writeU32(gps, 1)
    writeU32(gps, parts.min); writeU32(gps, 1)
    writeU32(gps, parts.sec); writeU32(gps, 10000)
  }
  dms(lat)
  dms(lon)
  gps.push(...[0x47, 0x50, 0x53, 0x00, 0x00, 0x00, 0x00])
  const body = [...tiff, ...gps]
  const segment = [0xff, 0xe1, 0x00, 0x00, ...EXIF_HEADER, ...body]
  const size = segment.length - 2
  segment[2] = (size >> 8) & 0xff
  segment[3] = size & 0xff
  return new Uint8Array(segment)
}

export function readEmbeddedLocation(bytes: Uint8Array): EmbeddedLocation | null {
  const found = readGps(bytes)
  if (!found) return null
  if (!Number.isFinite(found.latitude) || !Number.isFinite(found.longitude)) return null
  if (found.latitude < -90 || found.latitude > 90 || found.longitude < -180 || found.longitude > 180) return null
  return found
}

export function stampLocation(bytes: Uint8Array, location: EmbeddedLocation): Uint8Array {
  if (bytes.length < 2 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    throw new Error('Only a JPEG can carry an embedded location.')
  }
  const segment = buildGpsExif(location.latitude, location.longitude)
  const out = new Uint8Array(bytes.length + segment.length)
  out.set(bytes.subarray(0, 2), 0)
  out.set(segment, 2)
  out.set(bytes.subarray(2), 2 + segment.length)
  return out
}

export const UNABLE_TO_UPLOAD = 'unable to upload'
