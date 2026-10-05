import { normalizeNoaaPlace } from './noaa-storm-events-core.mjs'
import { NOAA_SEARCH_URL } from './noaa-storm-events-browser.mjs'

const NOAA_FILE_PATH = /^\/pub\/data\/swdi\/stormevents\/csvfiles\/StormEvents_details-ftp_v1\.0_d(\d{4})_c\d{8}\.csv\.gz$/
const EVENT_DATE = /^(?:\d{1,2}\/\d{1,2}\/\d{4}(?:\s+\d{1,2}:\d{2}:\d{2})?|\d{1,2}-[A-Z]{3}-\d{2}\s+\d{1,2}:\d{2}:\d{2})$/i

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function officialFileUrl(value) {
  if (typeof value !== 'string') return null
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.hostname !== 'www.ncei.noaa.gov' || url.port || url.username || url.password || url.search || url.hash) return null
    const match = NOAA_FILE_PATH.exec(url.pathname)
    return match ? { url: url.toString(), year: Number(match[1]) } : null
  } catch {
    return null
  }
}

/** Validate the browser-imported public rows before persistence; user address data is never accepted here. */
export function validateNoaaStormHistory(value, { county, state, nowYear = new Date().getUTCFullYear() } = {}) {
  if (!isRecord(value)) return { error: 'NOAA lookup result must be an object.' }
  const normalizedCounty = normalizeNoaaPlace(county)
  const normalizedState = normalizeNoaaPlace(state)
  if (!Number.isInteger(nowYear) || !normalizedCounty || !normalizedState) return { error: 'The inspection does not have a verified county and state for this lookup.' }

  const startYear = nowYear - 1
  const endYear = nowYear
  if (value.startYear !== startYear || value.endYear !== endYear) return { error: 'The NOAA lookup window must be the current and previous event years.' }
  const expectedYears = [startYear, endYear]
  if (value.county !== normalizedCounty || value.state !== normalizedState) return { error: 'The NOAA county/state result does not match the geocoded inspection.' }
  if (!Array.isArray(value.files) || value.files.length > 2 || !Array.isArray(value.unavailableYears) || value.unavailableYears.some((year) => !expectedYears.includes(year))) {
    return { error: 'NOAA source file metadata is invalid.' }
  }
  if (!Array.isArray(value.events) || value.events.length > 200) return { error: 'The NOAA event list exceeds the safe report limit.' }

  const filesByYear = new Map()
  for (const file of value.files) {
    if (!isRecord(file) || !Number.isInteger(file.year) || !expectedYears.includes(file.year) || filesByYear.has(file.year)) return { error: 'NOAA annual source file metadata is invalid.' }
    const official = officialFileUrl(file.url)
    if (!official || official.year !== file.year || !Number.isInteger(file.rowsRead) || file.rowsRead < 0 || file.rowsRead > 1_000_000) return { error: 'NOAA source URL or row count is invalid.' }
    if (typeof file.lastModified !== 'string' || file.lastModified.length > 80) return { error: 'NOAA source timestamp metadata is invalid.' }
    filesByYear.set(file.year, official.url)
  }

  const unavailable = new Set(value.unavailableYears)
  for (const year of expectedYears) {
    if (filesByYear.has(year) === unavailable.has(year)) return { error: 'NOAA source coverage is internally inconsistent.' }
  }
  const expectedStatus = unavailable.size === 0 ? 'complete' : filesByYear.size > 0 ? 'partial' : 'unknown'
  if (value.status !== expectedStatus) return { error: 'NOAA lookup status does not match annual source coverage.' }
  if (expectedStatus === 'unknown' && value.events.length) return { error: 'Unavailable NOAA data cannot contain event claims.' }
  if (expectedStatus !== 'unknown' && value.status !== 'complete' && value.status !== 'partial') return { error: 'NOAA lookup status is invalid.' }

  const seen = new Set()
  const events = []
  for (const event of value.events) {
    if (!isRecord(event)) return { error: 'NOAA event record is invalid.' }
    const eventId = typeof event.eventId === 'string' ? event.eventId : ''
    const eventType = typeof event.eventType === 'string' ? event.eventType.trim() : ''
    const beginDateTime = typeof event.beginDateTime === 'string' ? event.beginDateTime.trim() : ''
    const eventYear = event.dataYear
    const eventCounty = typeof event.county === 'string' ? normalizeNoaaPlace(event.county) : ''
    const eventState = typeof event.state === 'string' ? normalizeNoaaPlace(event.state) : ''
    const source = officialFileUrl(event.sourceUrl)
    if (!/^\d{1,12}$/.test(eventId) || !eventType || eventType.length > 100 || /\$\s?\d/.test(eventType) || !EVENT_DATE.test(beginDateTime)) return { error: 'NOAA event ID, type, or date/time is invalid.' }
    if (!source || filesByYear.get(eventYear) !== source.url) return { error: 'NOAA event source must be one of the loaded official annual files.' }
    if (event.zoneType !== 'C' || eventYear !== source.year || eventCounty !== normalizedCounty || eventState !== normalizedState) return { error: 'NOAA event location or county-level classification does not match the inspection.' }
    const eventKey = `${eventYear}:${eventId}`
    if (seen.has(eventKey)) return { error: 'Duplicate NOAA event IDs are not allowed.' }
    seen.add(eventKey)
    events.push({
      eventId,
      eventType,
      beginDateTime,
      county: normalizedCounty,
      state: normalizedState,
      zoneType: 'C',
      dataYear: eventYear,
      sourceUrl: source.url,
    })
  }

  return {
    data: {
      status: expectedStatus,
      county: normalizedCounty,
      state: normalizedState,
      startYear,
      endYear,
      retrievedAt: new Date().toISOString(),
      lookupMethod: 'Browser-side parse of public NOAA/NCEI annual CSV files; technician review required.',
      events,
      files: value.files.map((file) => ({
        year: file.year,
        url: filesByYear.get(file.year),
        rowsRead: file.rowsRead,
        lastModified: file.lastModified,
      })),
      unavailableYears: expectedYears.filter((year) => unavailable.has(year)),
      truncated: value.truncated === true,
      reason: expectedStatus === 'complete' ? null : 'One or more annual NOAA source files could not be read. A blank result is not evidence that no storms occurred.',
      searchUrl: NOAA_SEARCH_URL,
    },
  }
}
