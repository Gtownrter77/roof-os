// Portable EXIF GPS reader/writer shared by browser, server, and Expo.
// Only actual coordinates in the photo bytes qualify for photo automation.
const decoder = new TextDecoder()
const encoder = new TextEncoder()
const asBytes = (input) => input instanceof Uint8Array ? input : new Uint8Array(input)
const isJpeg = (b) => b.length >= 4 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff
const isPng = (b) => b.length > 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => b[i] === v)
const isWebP = (b) => b.length >= 12 && decoder.decode(b.subarray(0, 4)) === 'RIFF' && decoder.decode(b.subarray(8, 12)) === 'WEBP'
const readU16BE = (b, i) => (b[i] << 8) | b[i + 1]
const readU32BE = (b, i) => ((b[i] * 0x1000000) + (b[i + 1] << 16) + (b[i + 2] << 8) + b[i + 3]) >>> 0
const ascii = (bytes) => decoder.decode(bytes).replace(/\0.*$/s, '').trim()

function findExif(bytes) {
  if (isJpeg(bytes)) {
    let offset = 2
    while (offset + 4 <= bytes.length) {
      if (bytes[offset] !== 0xff) break
      const marker = bytes[offset + 1]
      if (marker === 0xda || marker === 0xd9) break
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { offset += 2; continue }
      const length = readU16BE(bytes, offset + 2)
      if (length < 2 || offset + 2 + length > bytes.length) break
      if (marker === 0xe1 && length >= 8 && ascii(bytes.subarray(offset + 4, offset + 10)) === 'Exif') {
        return bytes.subarray(offset + 10, offset + 2 + length)
      }
      offset += length + 2
    }
  } else if (isPng(bytes)) {
    let offset = 8
    while (offset + 12 <= bytes.length) {
      const length = readU32BE(bytes, offset)
      const end = offset + 12 + length
      if (end > bytes.length) break
      const kind = decoder.decode(bytes.subarray(offset + 4, offset + 8))
      if (kind === 'eXIf') return bytes.subarray(offset + 8, offset + 8 + length)
      if (kind === 'IEND') break
      offset = end
    }
  } else if (isWebP(bytes)) {
    let offset = 12
    while (offset + 8 <= bytes.length) {
      const kind = decoder.decode(bytes.subarray(offset, offset + 4))
      const length = (bytes[offset + 4] + (bytes[offset + 5] << 8) + (bytes[offset + 6] << 16) + (bytes[offset + 7] * 0x1000000)) >>> 0
      const end = offset + 8 + length
      if (end > bytes.length) break
      if (kind === 'EXIF') {
        const data = bytes.subarray(offset + 8, end)
        return ascii(data.subarray(0, 6)) === 'Exif' ? data.subarray(6) : data
      }
      offset = end + (length & 1)
    }
  }
  return null
}

function parseTiffLocation(bytes) {
  if (!bytes || bytes.length < 14) return null
  const order = String.fromCharCode(bytes[0], bytes[1])
  if (order !== 'II' && order !== 'MM') return null
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const little = order === 'II'
  const u16 = (at) => { if (at < 0 || at + 2 > bytes.length) throw new Error('EXIF truncated'); return view.getUint16(at, little) }
  const u32 = (at) => { if (at < 0 || at + 4 > bytes.length) throw new Error('EXIF truncated'); return view.getUint32(at, little) }
  if (u16(2) !== 42) return null
  const sizes = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1 }
  const ifd = (at) => {
    if (at < 8 || at + 2 > bytes.length) throw new Error('EXIF invalid IFD')
    const count = u16(at)
    if (count > 128 || at + 2 + count * 12 + 4 > bytes.length) throw new Error('EXIF invalid IFD entries')
    const result = new Map()
    for (let i = 0; i < count; i++) {
      const pos = at + 2 + i * 12, tag = u16(pos), type = u16(pos + 2), n = u32(pos + 4)
      const size = sizes[type] * n
      if (!Number.isSafeInteger(size) || size < 0 || size > 2048) continue
      const start = size <= 4 ? pos + 8 : u32(pos + 8)
      if (start + size > bytes.length) continue
      result.set(tag, { type, n, start })
    }
    return result
  }
  try {
    const root = ifd(u32(4)), pointer = root.get(0x8825)
    if (!pointer || pointer.type !== 4 || pointer.n !== 1) return null
    const gps = ifd(u32(pointer.start))
    const ref = (tag) => {
      const value = gps.get(tag)
      return value && value.type === 2 ? ascii(bytes.subarray(value.start, value.start + value.n)).toUpperCase() : ''
    }
    const dms = (tag) => {
      const value = gps.get(tag)
      if (!value || value.type !== 5 || value.n !== 3) return null
      const parts = []
      for (let i = 0; i < 3; i++) {
        const numerator = u32(value.start + i * 8), denominator = u32(value.start + i * 8 + 4)
        if (denominator === 0) return null
        parts.push(numerator / denominator)
      }
      if (parts[1] >= 60 || parts[2] >= 60) return null
      return parts[0] + parts[1] / 60 + parts[2] / 3600
    }
    const latRef = ref(1), lonRef = ref(3), north = dms(2), east = dms(4)
    if (!['N', 'S'].includes(latRef) || !['E', 'W'].includes(lonRef) || north === null || east === null || north > 90 || east > 180) return null
    const description = root.get(0x010e)
    const text = description?.type === 2 ? ascii(bytes.subarray(description.start, description.start + description.n)) : ''
    const match = /^ROOFOS property: (.*?); captured: (.*)$/s.exec(text)
    return {
      latitude: latRef === 'S' ? -north : north,
      longitude: lonRef === 'W' ? -east : east,
      address: match ? match[1] : null,
      capturedAt: match ? match[2] : null,
    }
  } catch {
    return null
  }
}
export function readEmbeddedGps(input) { return parseTiffLocation(findExif(asBytes(input))) }
export function hasEmbeddedGps(input) { return readEmbeddedGps(input) !== null }

export function embedGpsIntoJpeg(input, details) {
  const bytes = asBytes(input)
  if (!isJpeg(bytes)) throw new Error('GPS stamping requires a JPEG photo')
  const { latitude, longitude, address = '', capturedAt = new Date().toISOString() } = details
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) throw new Error('Valid GPS coordinates are required')
  const description = encoder.encode('ROOFOS property: ' + String(address).replace(/[\0\r\n;]/g, ' ').slice(0, 240) + '; captured: ' + capturedAt + '\0')
  const gpsIfdOffset = 8 + 2 + 2 * 12 + 4
  const dataOffset = gpsIfdOffset + 2 + 5 * 12 + 4
  const latitudeOffset = dataOffset, longitudeOffset = latitudeOffset + 24, descriptionOffset = longitudeOffset + 24
  const tiff = new Uint8Array(descriptionOffset + description.length)
  const view = new DataView(tiff.buffer)
  const u16 = (pos, value) => view.setUint16(pos, value, true)
  const u32 = (pos, value) => view.setUint32(pos, value, true)
  tiff[0] = 0x49; tiff[1] = 0x49
  u16(2, 42); u32(4, 8); u16(8, 2)
  const entry = (pos, tag, type, count, value) => { u16(pos, tag); u16(pos + 2, type); u32(pos + 4, count); u32(pos + 8, value) }
  entry(10, 0x010e, 2, description.length, descriptionOffset)
  entry(22, 0x8825, 4, 1, gpsIfdOffset)
  u32(34, 0)
  u16(gpsIfdOffset, 5)
  let g = gpsIfdOffset + 2
  entry(g, 1, 2, 2, latitude >= 0 ? 0x4e : 0x53); g += 12
  entry(g, 2, 5, 3, latitudeOffset); g += 12
  entry(g, 3, 2, 2, longitude >= 0 ? 0x45 : 0x57); g += 12
  entry(g, 4, 5, 3, longitudeOffset); g += 12
  entry(g, 0, 1, 4, 0x00000302); g += 12
  u32(g, 0)
  const writeDms = (pos, n) => {
    const absolute = Math.abs(n), deg = Math.floor(absolute), minutes = Math.floor((absolute - deg) * 60)
    const seconds = Math.round(((absolute - deg) * 60 - minutes) * 60 * 100000)
    const values = [[deg, 1], [minutes, 1], [seconds, 100000]]
    values.forEach(([a, b], i) => { u32(pos + i * 8, a); u32(pos + i * 8 + 4, b) })
  }
  writeDms(latitudeOffset, latitude); writeDms(longitudeOffset, longitude)
  tiff.set(description, descriptionOffset)
  const exif = new Uint8Array(6 + tiff.length)
  exif.set([69, 120, 105, 102, 0, 0], 0); exif.set(tiff, 6)
  if (exif.length + 2 > 65535) throw new Error('EXIF metadata too large')
  const segment = new Uint8Array(exif.length + 4)
  segment[0] = 0xff; segment[1] = 0xe1; segment[2] = ((exif.length + 2) >> 8) & 255; segment[3] = (exif.length + 2) & 255; segment.set(exif, 4)
  // Replace, rather than duplicate, prior EXIF blocks; retain compressed image bytes.
  const segments = [bytes.subarray(0, 2), segment]
  let offset = 2
  while (offset < bytes.length) {
    if (bytes[offset] !== 0xff || offset + 4 > bytes.length) { segments.push(bytes.subarray(offset)); break }
    const marker = bytes[offset + 1]
    if (marker === 0xda || marker === 0xd9) { segments.push(bytes.subarray(offset)); break }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { segments.push(bytes.subarray(offset, offset + 2)); offset += 2; continue }
    const length = readU16BE(bytes, offset + 2)
    if (length < 2 || offset + length + 2 > bytes.length) throw new Error('Invalid JPEG segment')
    const isOldExif = marker === 0xe1 && ascii(bytes.subarray(offset + 4, offset + 10)) === 'Exif'
    if (!isOldExif) segments.push(bytes.subarray(offset, offset + length + 2))
    offset += length + 2
  }
  const output = new Uint8Array(segments.reduce((n, part) => n + part.length, 0))
  let at = 0
  for (const part of segments) { output.set(part, at); at += part.length }
  const found = readEmbeddedGps(output)
  if (!found || Math.abs(found.latitude - latitude) > 0.00001 || Math.abs(found.longitude - longitude) > 0.00001) throw new Error('GPS embed verification failed')
  return output
}
