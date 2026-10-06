import assert from 'node:assert/strict'
import { buildRadarWmsTileTemplate, getRadarServiceForPoint, OPENFREEMAP_DARK_STYLE } from '../lib/services/radar-source.mjs'

assert.equal(OPENFREEMAP_DARK_STYLE, 'https://tiles.openfreemap.org/styles/dark')
for (const [lat, lon, region] of [
  [33.751, -84.747, 'conus'],
  [61.218, -149.900, 'alaska'],
  [21.307, -157.858, 'hawaii'],
  [18.466, -66.106, 'carib'],
  [13.444, 144.794, 'guam'],
]) {
  const service = getRadarServiceForPoint(lat, lon)
  assert.equal(service?.region, region)
  assert.equal(service?.layer, `${region}_bref_qcd`)
  assert.match(service?.wmsUrl ?? '', /^https:\/\/opengeo\.ncep\.noaa\.gov\/geoserver\//)
  assert.equal(service?.resolution, '1 km composite grid')
  const tiles = buildRadarWmsTileTemplate(service)
  assert.ok(tiles?.includes('bbox={bbox-epsg-3857}'))
  assert.ok(tiles?.includes('request=GetMap'))
}

assert.equal(getRadarServiceForPoint(0, 0), null)
assert.equal(getRadarServiceForPoint(51.5, 0.1), null)
assert.equal(getRadarServiceForPoint(Number.NaN, -84), null)
assert.equal(buildRadarWmsTileTemplate(null), null)
console.log('NOAA/OpenFreeMap radar source tests passed')
