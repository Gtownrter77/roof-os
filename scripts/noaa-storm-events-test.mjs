import assert from 'node:assert/strict'
import { gzipSync } from 'node:zlib'
import { forEachCsvRecord, getNoaaCountyStormEvents, normalizeNoaaPlace } from '../lib/reports/noaa-storm-events.mjs'
import { fetchNoaaCountyStormEventsInBrowser } from '../lib/reports/noaa-storm-events-browser.mjs'
import { validateNoaaStormHistory } from '../lib/reports/noaa-storm-evidence.mjs'

const parsed = []
forEachCsvRecord('a,b,narrative\r\n1,2,"comma, quote ""inside"" and\nnewline"\r\n', (row) => parsed.push(row))
assert.deepEqual(parsed, [['a', 'b', 'narrative'], ['1', '2', 'comma, quote "inside" and\nnewline']])
assert.throws(() => forEachCsvRecord('a,b\n1,"unclosed', () => {}), /Unclosed/)
assert.equal(normalizeNoaaPlace('Wake County'), 'WAKE')
assert.equal(normalizeNoaaPlace('North Carolina'), 'NORTH CAROLINA')

const header = ['EVENT_ID', 'STATE', 'CZ_TYPE', 'CZ_NAME', 'BEGIN_DATE_TIME', 'EVENT_TYPE', 'EVENT_NARRATIVE']
const csvRow = (values) => values.map((value) => {
  const text = String(value ?? '')
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}).join(',')
const detailCsv = (rows) => `${csvRow(header)}\r\n${rows.map(csvRow).join('\r\n')}\r\n`
const record = (id, state, type, county, time, event) => [id, state, type, county, time, event, 'NOAA narrative has commas, quotes "and" newlines\nwithout leaving the quoted field.']
const fileNames = [
  'StormEvents_details-ftp_v1.0_d2025_c20260110.csv.gz',
  'StormEvents_details-ftp_v1.0_d2026_c20260918.csv.gz',
]
const indexHtml = fileNames.map((name) => `<a href="${name}">${name}</a>`).join('\n')
const contents = new Map([
  [fileNames[0], detailCsv([
    record('234', 'NORTH CAROLINA', 'C', 'WAKE COUNTY', '04/04/2025 09:15:00', 'Thunderstorm Wind'),
    record('235', 'NORTH CAROLINA', 'Z', 'WAKE', '04/05/2025 09:15:00', 'Tornado'),
    record('236', 'NORTH CAROLINA', 'C', 'DURHAM', '04/06/2025 09:15:00', 'Hail'),
    record('237', 'SOUTH CAROLINA', 'C', 'WAKE', '04/07/2025 09:15:00', 'Hail'),
  ])],
  [fileNames[1], detailCsv([record('345', 'NORTH CAROLINA', 'C', 'WAKE', '05/06/2026 12:30:00', 'Hail')])],
])
const fetchMock = async (input) => {
  const url = String(input)
  if (url === 'https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/') {
    return new Response(indexHtml, { status: 200, headers: { 'content-type': 'text/html', 'content-length': String(Buffer.byteLength(indexHtml)) } })
  }
  const name = url.split('/').at(-1)
  const csv = contents.get(name)
  if (!csv) return new Response('not found', { status: 404 })
  const gzip = gzipSync(csv)
  return new Response(gzip, { status: 200, headers: { 'content-type': 'application/gzip', 'content-length': String(gzip.length), 'last-modified': 'Wed, 01 Oct 2026 12:00:00 GMT' } })
}

const result = await getNoaaCountyStormEvents({ county: 'Wake County', state: 'North Carolina', nowYear: 2026, fetchImpl: fetchMock })
assert.equal(result.status, 'complete', 'both years are required for a complete window')
assert.equal(result.startYear, 2025)
assert.equal(result.endYear, 2026)
assert.deepEqual(result.events.map((event) => event.eventId), ['345', '234'], 'only exact county/state county-level records are returned, newest first')
assert.equal(result.events[0].eventType, 'Hail')
assert.equal(result.events[0].dataYear, 2026)
assert.match(result.events[0].sourceUrl, /^https:\/\/www\.ncei\.noaa\.gov\/pub\/data\/swdi\/stormevents\/csvfiles\//)
assert.equal(result.files.length, 2)
assert.equal(result.unavailableYears.length, 0)

const progress = []
const browserResult = await fetchNoaaCountyStormEventsInBrowser({ county: 'Wake County', state: 'North Carolina', nowYear: 2026, fetchImpl: fetchMock, onProgress: (entry) => progress.push(entry) })
assert.equal(browserResult.status, 'complete', 'browser-side NOAA gzip parsing loads both source years')
assert.deepEqual(browserResult.events.map((event) => event.eventId), ['345', '234'])
assert.equal(progress.filter((entry) => entry.status === 'complete').length, 2)
const safeHistory = validateNoaaStormHistory(browserResult, { county: 'WAKE', state: 'North Carolina', nowYear: 2026 })
assert.equal(safeHistory.data.status, 'complete', 'server validator accepts only the current official two-year result')
const forgedHistory = { ...browserResult, events: [{ ...browserResult.events[0], sourceUrl: 'https://evil.example/data.csv' }] }
assert.match(validateNoaaStormHistory(forgedHistory, { county: 'WAKE', state: 'North Carolina', nowYear: 2026 }).error, /source/)

const partial = await getNoaaCountyStormEvents({
  county: 'Other County',
  state: 'North Carolina',
  nowYear: 2026,
  fetchImpl: async (url, options) => {
    const response = await fetchMock(url, options)
    if (String(url).includes('_d2025_')) return new Response('not found', { status: 404 })
    return response
  },
})
assert.equal(partial.status, 'partial')
assert.deepEqual(partial.unavailableYears, [2025])
assert.equal(partial.events.length, 0)

const unknown = await getNoaaCountyStormEvents({ county: '', state: 'North Carolina', nowYear: 2026, fetchImpl: fetchMock })
assert.equal(unknown.status, 'unknown')
assert.match(unknown.reason, /county and state/)
console.log('noaa-storm-events-test: PASS (public source, bounded two-year window, robust CSV parsing, exact county/state match, Unknown on incomplete coverage)')
