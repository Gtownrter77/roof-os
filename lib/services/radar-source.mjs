export const OPENFREEMAP_DARK_STYLE = 'https://tiles.openfreemap.org/styles/dark'

const SERVICE_ROOT = 'https://opengeo.ncep.noaa.gov/geoserver'

/** Return a public NWS MRMS composite service only for covered U.S. regions. */
export function getRadarServiceForPoint(latitude, longitude) {
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) return null

  let region
  if (latitude >= 50 && latitude <= 73 && longitude >= -180 && longitude <= -129) region = 'alaska'
  else if (latitude >= 18 && latitude <= 23.5 && longitude >= -161 && longitude <= -154) region = 'hawaii'
  else if (latitude >= 17 && latitude <= 20 && longitude >= -69 && longitude <= -64) region = 'carib'
  else if (latitude >= 12.5 && latitude <= 14 && longitude >= 144 && longitude <= 146) region = 'guam'
  else if (latitude >= 24 && latitude <= 50 && longitude >= -125 && longitude <= -66) region = 'conus'
  else return null

  const layer = `${region}_bref_qcd`
  return {
    region,
    layer,
    label: 'NOAA/NWS MRMS quality-controlled base reflectivity',
    wmsUrl: `${SERVICE_ROOT}/${region}/${layer}/ows`,
    attribution: 'Radar: NOAA/NWS MRMS · Basemap: OpenFreeMap · © OpenStreetMap contributors',
    resolution: '1 km composite grid',
  }
}

export function buildRadarWmsTileTemplate(service) {
  if (!service || typeof service.wmsUrl !== 'string' || typeof service.layer !== 'string') return null
  return `${service.wmsUrl}?service=WMS&version=1.1.1&request=GetMap&layers=${encodeURIComponent(service.layer)}&styles=&format=image%2Fpng&transparent=true&srs=EPSG%3A3857&width=256&height=256&bbox={bbox-epsg-3857}`
}
