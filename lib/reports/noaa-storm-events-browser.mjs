import { forEachCsvRecord, normalizeNoaaPlace } from './noaa-storm-events-core.mjs'

export const NOAA_CSV_INDEX_URL = 'https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/'
export const NOAA_SEARCH_URL = 'https://www.ncei.noaa.gov/access/storm-events-database/search'
const MAX_INDEX_BYTES = 2 * 1024 * 1024
const MAX_COMPRESSED_BYTES = 18 * 1024 * 1024
const MAX_EXPANDED_BYTES = 96 * 1024 * 1024
const MAX_EVENTS = 200

function resultUnknown(county, state, years, reason) {
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
    searchUrl: NOAA_SEARCH_URL,
  }
}

function fileIndex(html) {
  const byYear = new Map()
  const pattern = /href\s*=\s*["']?(StormEvents_details-ftp_v1\.0_d(\d{4})_c(\d{8})\.csv\.gz)["'\s>]/gi
  for (const match of html.matchAll(pattern)) {
    const year = Number(match[2])
    const existing = byYear.get(year)
    if (!existing || match[3] > existing.created) byYear.set(year, { name: match[1], created: match[3] })
  }
  return byYear
}

async function readCompressedCsvText(response) {
  if (!response.body || typeof DecompressionStream === 'undefined') throw new Error('Browser gzip decompression is unavailable.')
  const declaredSize = Number(response.headers.get('content-length'))
  if (Number.isFinite(declaredSize) && declaredSize > MAX_COMPRESSED_BYTES) throw new Error('NOAA file exceeds the safe compressed size limit.')

  const reader = response.body.pipeThrough(new DecompressionStream('gzip')).getReader()
  const decoder = new TextDecoder()
  let text = ''
  let expandedBytes = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      expandedBytes += value.byteLength
      if (expandedBytes > MAX_EXPANDED_BYTES) {
        await reader.cancel().catch(() => {})
        throw new Error('NOAA file exceeds the safe expanded size limit.')
      }
      text += decoder.decode(value, { stream: true })
    }
    text += decoder.decode()
    return text
  } finally {
    reader.releaseLock()
  }
}

function parseCountyFile(text, year, county, state, sourceUrl) {
  let headers = null
  const events = []
  let rowsRead = 0
  forEachCsvRecord(text, (values) => {
    if (!headers) {
      headers = values.map((value, index) => (index === 0 ? value.replace(/^\uFEFF/, '') : value).trim().toLowerCase())
      const required = ['event_id', 'state', 'cz_type', 'cz_name', 'begin_date_time', 'event_type']
      if (required.some((name) => !headers.includes(name))) throw new Error('NOAA CSV columns do not match the documented source format.')
      return
    }
    if (!values.length) return
    rowsRead += 1
    if (rowsRead > 1_000_000) throw new Error('NOAA CSV row ceiling exceeded.')
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
      zoneType: 'C',
      dataYear: year,
      sourceUrl,
    })
  })
  if (!headers) throw new Error('NOAA CSV contains no header row.')
  return { events, rowsRead }
}

function dateRank(value) {
  const time = Date.parse(value)
  return Number.isFinite(time) ? time : 0
}

/**
 * Download and filter the two most recent annual NCEI detail CSVs in the user's
 * browser. CORS-enabled public files are read directly; no property address or
 * coordinates are transmitted to NOAA, and no third-party API key is needed.
 */
export async function fetchNoaaCountyStormEventsInBrowser({ county, state, nowYear = new Date().getUTCFullYear(), fetchImpl = fetch, onProgress = () => {} } = {}) {
  const years = [nowYear - 1, nowYear]
  if (!Number.isInteger(nowYear) || nowYear < 1952 || !normalizeNoaaPlace(county) || !normalizeNoaaPlace(state)) {
    return resultUnknown(county, state, years, 'A geocoded county and state are required for this lookup.')
  }
  if (typeof DecompressionStream === 'undefined') {
    return resultUnknown(county, state, years, 'This browser cannot decompress the NOAA public gzip files. Open the official NCEI search instead.')
  }

  let indexResponse
  try {
    indexResponse = await fetchImpl(NOAA_CSV_INDEX_URL, { headers: { accept: 'text/html' }, cache: 'force-cache' })
    if (!indexResponse.ok) throw new Error('NOAA index request failed.')
    const indexLength = Number(indexResponse.headers.get('content-length'))
    if (Number.isFinite(indexLength) && indexLength > MAX_INDEX_BYTES) throw new Error('NOAA index exceeded the safe size limit.')
  } catch {
    return resultUnknown(county, state, years, 'The NOAA/NCEI public CSV index could not be loaded. Use the official search link to verify storm history.')
  }

  let indexHtml
  try {
    indexHtml = await indexResponse.text()
    if (new TextEncoder().encode(indexHtml).byteLength > MAX_INDEX_BYTES) throw new Error('Index is too large.')
  } catch {
    return resultUnknown(county, state, years, 'The NOAA/NCEI public CSV index was incomplete. Use the official search link to verify storm history.')
  }
  const index = fileIndex(indexHtml)
  const files = []
  const unavailableYears = []
  const events = []

  for (let position = 0; position < years.length; position += 1) {
    const year = years[position]
    const file = index.get(year)
    if (!file) {
      unavailableYears.push(year)
      onProgress({ year, position: position + 1, total: years.length, status: 'unavailable' })
      continue
    }
    const sourceUrl = new URL(file.name, NOAA_CSV_INDEX_URL).toString()
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 60_000)
    onProgress({ year, position: position + 1, total: years.length, status: 'downloading' })
    try {
      const response = await fetchImpl(sourceUrl, { headers: { accept: 'application/gzip' }, cache: 'force-cache', signal: controller.signal })
      if (!response.ok) throw new Error('NOAA annual file request failed.')
      const parsed = parseCountyFile(await readCompressedCsvText(response), year, county, state, sourceUrl)
      files.push({ year, url: sourceUrl, rowsRead: parsed.rowsRead, lastModified: response.headers.get('last-modified') || 'Unknown' })
      events.push(...parsed.events)
      onProgress({ year, position: position + 1, total: years.length, status: 'complete' })
    } catch {
      unavailableYears.push(year)
      onProgress({ year, position: position + 1, total: years.length, status: 'unavailable' })
    } finally {
      clearTimeout(timeout)
    }
  }

  events.sort((left, right) => dateRank(right.beginDateTime) - dateRank(left.beginDateTime))
  const result = {
    status: unavailableYears.length === 0 ? 'complete' : files.length > 0 ? 'partial' : 'unknown',
    county: normalizeNoaaPlace(county),
    state: normalizeNoaaPlace(state),
    startYear: years[0],
    endYear: years.at(-1),
    retrievedAt: new Date().toISOString(),
    events: events.slice(0, MAX_EVENTS),
    files,
    unavailableYears,
    truncated: events.length > MAX_EVENTS,
    reason: unavailableYears.length ? 'One or more annual NOAA source files could not be read. A blank result is not evidence that no storms occurred.' : null,
    searchUrl: NOAA_SEARCH_URL,
  }
  return result
}
