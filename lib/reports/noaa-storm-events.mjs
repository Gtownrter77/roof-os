import { gunzipSync } from 'node:zlib'
import { forEachCsvRecord, normalizeNoaaPlace } from './noaa-storm-events-core.mjs'
export { forEachCsvRecord, normalizeNoaaPlace } from './noaa-storm-events-core.mjs'

export const NOAA_STORM_EVENTS_INDEX = 'https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/'
export const NOAA_STORM_EVENTS_SEARCH = 'https://www.ncei.noaa.gov/access/storm-events-database/search'
const MAX_INDEX_BYTES = 2 * 1024 * 1024
const MAX_COMPRESSED_FILE_BYTES = 18 * 1024 * 1024
const MAX_EXPANDED_FILE_BYTES = 96 * 1024 * 1024
const MAX_DISPLAY_EVENTS = 200
const CACHE_TTL_MS = 60 * 60 * 1000
const resultCache = new Map()

function unknownResult(county, state, years, reason) {
  return {
    status: 'unknown',
    county: normalizeNoaaPlace(county) || 'Unknown',
    state: normalizeNoaaPlace(state) || 'Unknown',
    startYear: years[0],
    endYear: years.at(-1),
    retrievedAt: new Date().toISOString(),
    events: [],
    files: [],
    unavailableYears: years,
    truncated: false,
    reason,
    searchUrl: NOAA_STORM_EVENTS_SEARCH,
  }
}

async function fetchBounded(url, maxBytes, timeoutMs, fetchImpl) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetchImpl(url, {
      headers: { accept: '*/*', 'user-agent': 'ROOF-OS/1.0 (https://github.com/Gtownrter77/roof-os)' },
      cache: 'no-store',
      signal: controller.signal,
    })
    if (!response.ok || !response.body) return { ok: false }
    const declaredSize = Number(response.headers.get('content-length'))
    if (Number.isFinite(declaredSize) && declaredSize > maxBytes) {
      await response.body.cancel().catch(() => {})
      return { ok: false }
    }

    const reader = response.body.getReader()
    const chunks = []
    let size = 0
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > maxBytes) {
        await reader.cancel().catch(() => {})
        return { ok: false }
      }
      chunks.push(Buffer.from(value))
    }
    return {
      ok: true,
      bytes: Buffer.concat(chunks, size),
      lastModified: response.headers.get('last-modified') || 'Unknown',
    }
  } catch {
    return { ok: false }
  } finally {
    clearTimeout(timeout)
  }
}

function extractFileIndex(html) {
  const files = new Map()
  const pattern = /href\s*=\s*["']?(StormEvents_details-ftp_v1\.0_d(\d{4})_c(\d{8})\.csv\.gz)["'\s>]/gi
  for (const match of html.matchAll(pattern)) {
    const year = Number(match[2])
    const current = files.get(year)
    const candidate = { name: match[1], created: match[3] }
    if (!current || candidate.created > current.created) files.set(year, candidate)
  }
  return files
}

function eventDateRank(value) {
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? timestamp : 0
}

function parseYearFile(compressedBytes, expectedYear, county, state, sourceUrl, lastModified) {
  const text = gunzipSync(compressedBytes, { maxOutputLength: MAX_EXPANDED_FILE_BYTES }).toString('utf8')
  let headers = null
  const events = []
  let seenRows = 0

  forEachCsvRecord(text, (values) => {
    if (!headers) {
      headers = values.map((value, index) => (index === 0 ? value.replace(/^\uFEFF/, '') : value).trim().toLowerCase())
      const required = ['event_id', 'state', 'cz_type', 'cz_name', 'begin_date_time', 'event_type']
      if (required.some((name) => !headers.includes(name))) throw new Error('Required NOAA columns are missing.')
      return
    }
    if (!values.length) return
    seenRows += 1
    if (seenRows > 1_000_000) throw new Error('NOAA CSV row ceiling exceeded.')

    const row = Object.fromEntries(headers.map((name, index) => [name, values[index] ?? '']))
    if (row.cz_type.trim().toUpperCase() !== 'C') return
    if (normalizeNoaaPlace(row.state) !== normalizeNoaaPlace(state)) return
    if (normalizeNoaaPlace(row.cz_name) !== normalizeNoaaPlace(county)) return
    const eventId = row.event_id.trim()
    const eventType = row.event_type.trim()
    const beginDateTime = row.begin_date_time.trim()
    if (!/^\d{1,12}$/.test(eventId) || !eventType || eventType.length > 100 || !beginDateTime || beginDateTime.length > 40) return

    events.push({
      eventId,
      eventType,
      beginDateTime,
      county: row.cz_name.trim(),
      state: row.state.trim(),
      dataYear: expectedYear,
      sourceUrl,
      lastModified,
    })
  })

  if (!headers) throw new Error('NOAA CSV has no header row.')
  return { events, rowsRead: seenRows }
}

/**
 * Fetch the current and previous annual NOAA/NCEI details files and retain exact
 * county-level matches only. This bounded recent window is not full history and
 * is not proof of damage to an individual property or a date of loss.
 */
export async function getNoaaCountyStormEvents({ county, state, nowYear = new Date().getUTCFullYear(), fetchImpl = fetch } = {}) {
  const years = [nowYear - 1, nowYear]
  if (!Number.isInteger(nowYear) || nowYear < 1952 || !normalizeNoaaPlace(county) || !normalizeNoaaPlace(state)) {
    return unknownResult(county, state, years, 'A geocoded county and state are required for this lookup.')
  }

  const normalizedCounty = normalizeNoaaPlace(county)
  const normalizedState = normalizeNoaaPlace(state)
  const cacheKey = `${normalizedState}|${normalizedCounty}|${years.join(',')}`
  const cached = resultCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) return structuredClone(cached.value)

  const indexResult = await fetchBounded(NOAA_STORM_EVENTS_INDEX, MAX_INDEX_BYTES, 12_000, fetchImpl)
  if (!indexResult.ok) return unknownResult(county, state, years, 'The NOAA/NCEI public data index was unavailable or exceeded the safe size limit.')
  const index = extractFileIndex(indexResult.bytes.toString('utf8'))
  const requests = years.map(async (year) => {
    const file = index.get(year)
    if (!file) return { year, ok: false }
    const url = new URL(file.name, NOAA_STORM_EVENTS_INDEX).toString()
    const result = await fetchBounded(url, MAX_COMPRESSED_FILE_BYTES, 25_000, fetchImpl)
    return { year, ok: result.ok, url, bytes: result.bytes, lastModified: result.lastModified }
  })
  const yearlyFiles = await Promise.all(requests)
  const events = []
  const files = []
  const unavailableYears = []
  let recordLimitReached = false

  for (const file of yearlyFiles) {
    if (!file.ok) {
      unavailableYears.push(file.year)
      continue
    }
    try {
      const parsed = parseYearFile(file.bytes, file.year, county, state, file.url, file.lastModified)
      files.push({ year: file.year, url: file.url, lastModified: file.lastModified, rowsRead: parsed.rowsRead })
      events.push(...parsed.events)
      if (events.length > 5_000) {
        events.sort((left, right) => eventDateRank(right.beginDateTime) - eventDateRank(left.beginDateTime))
        events.length = 5_000
        recordLimitReached = true
      }
    } catch {
      unavailableYears.push(file.year)
    }
  }

  events.sort((left, right) => eventDateRank(right.beginDateTime) - eventDateRank(left.beginDateTime))
  const truncated = recordLimitReached || events.length > MAX_DISPLAY_EVENTS
  const result = {
    status: unavailableYears.length === 0 ? 'complete' : files.length > 0 ? 'partial' : 'unknown',
    county: normalizedCounty,
    state: normalizedState,
    startYear: years[0],
    endYear: years.at(-1),
    retrievedAt: new Date().toISOString(),
    events: events.slice(0, MAX_DISPLAY_EVENTS),
    files,
    unavailableYears,
    truncated,
    reason: unavailableYears.length ? 'One or more annual NOAA source files were unavailable or did not match the documented format.' : null,
    searchUrl: NOAA_STORM_EVENTS_SEARCH,
  }
  if (resultCache.size >= 128) resultCache.delete(resultCache.keys().next().value)
  resultCache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, value: result })
  return structuredClone(result)
}
