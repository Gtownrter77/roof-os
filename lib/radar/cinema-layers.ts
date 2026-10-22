export const RADAR_PREFS_KEY = 'roofos.radar.cinema.layers.v1'

export type RadarLayerId =
  | 'bref'
  | 'cref'
  | 'echoTops'
  | 'precipType'
  | 'stormLoop'
  | 'alerts'
  | 'locationPin'
  | 'basemapLabels'
  | 'basemap'

export type RadarLayerPrefs = Record<RadarLayerId, boolean> & {
  radarOpacity: number
  alertsOpacity: number
}

export const DEFAULT_RADAR_LAYER_PREFS: RadarLayerPrefs = {
  bref: true,
  cref: false,
  echoTops: false,
  precipType: false,
  stormLoop: false,
  alerts: true,
  locationPin: true,
  basemapLabels: true,
  basemap: true,
  radarOpacity: 0.82,
  alertsOpacity: 0.45,
}

export type RadarProductDef = {
  id: Exclude<RadarLayerId, 'alerts' | 'locationPin' | 'basemapLabels' | 'basemap' | 'stormLoop'>
  label: string
  detail: string
  /** NOAA product suffix after region_ */
  product: string
  defaultOn: boolean
}

/** NOAA/NWS MRMS products available on opengeo.ncep.noaa.gov */
export const RADAR_PRODUCTS: RadarProductDef[] = [
  {
    id: 'bref',
    label: 'Base reflectivity',
    detail: 'Quality-controlled base reflectivity — classic storm watch layer',
    product: 'bref_qcd',
    defaultOn: true,
  },
  {
    id: 'cref',
    label: 'Composite reflectivity',
    detail: 'Column-max reflectivity — catches elevated cores',
    product: 'cref_qcd',
    defaultOn: false,
  },
  {
    id: 'echoTops',
    label: 'Echo tops',
    detail: 'Storm top height — how tall the cells are',
    product: 'neet_v18',
    defaultOn: false,
  },
  {
    id: 'precipType',
    label: 'Precipitation type',
    detail: 'Rain / mix / snow classification where available',
    product: 'pcpn_typ',
    defaultOn: false,
  },
]

export const RADAR_UI_LAYERS: Array<{ id: RadarLayerId; label: string; detail: string }> = [
  { id: 'bref', label: 'Base reflectivity', detail: 'Primary MRMS storm watch layer' },
  { id: 'cref', label: 'Composite reflectivity', detail: 'Column-max reflectivity' },
  { id: 'echoTops', label: 'Echo tops', detail: 'Storm top heights' },
  { id: 'precipType', label: 'Precip type', detail: 'Rain / mix / snow' },
  { id: 'stormLoop', label: 'Storm loop', detail: 'Last hour of NEXRAD, 5-minute steps' },
  { id: 'alerts', label: 'NWS alert polygons', detail: 'Active warning / watch areas' },
  { id: 'locationPin', label: 'Location pin', detail: 'Service area or GPS center' },
  { id: 'basemapLabels', label: 'Map labels', detail: 'City / road name labels' },
  { id: 'basemap', label: 'Basemap', detail: 'Dark terrain under radar' },
]

const SERVICE_ROOT = 'https://opengeo.ncep.noaa.gov/geoserver'

export function radarRegionForPoint(latitude: number, longitude: number): string | null {
  if (latitude >= 50 && latitude <= 73 && longitude >= -180 && longitude <= -129) return 'alaska'
  if (latitude >= 18 && latitude <= 23.5 && longitude >= -161 && longitude <= -154) return 'hawaii'
  if (latitude >= 17 && latitude <= 20 && longitude >= -69 && longitude <= -64) return 'carib'
  if (latitude >= 12.5 && latitude <= 14 && longitude >= 144 && longitude <= 146) return 'guam'
  if (latitude >= 24 && latitude <= 50 && longitude >= -125 && longitude <= -66) return 'conus'
  return null
}

/** Oldest → newest. IEM publishes these lagged CONUS/AK/HI/PR/GU mosaics. */
export const STORM_LOOP_MINUTES = [55, 50, 45, 40, 35, 30, 25, 20, 15, 10, 5, 0] as const

const IEM_NEXRAD_ROOT = 'https://mesonet.agron.iastate.edu/cgi-bin/wms/nexrad/n0q.cgi'

export function iemRegionCode(region: string) {
  if (region === 'alaska') return 'ak'
  if (region === 'hawaii') return 'hi'
  if (region === 'guam') return 'gu'
  if (region === 'carib') return 'pr'
  return 'conus'
}

/** Public IEM NEXRAD base reflectivity tile. minutesAgo 0 is the latest mosaic. */
export function buildIemReflectivityTileUrl(region: string, minutesAgo: number) {
  const code = iemRegionCode(region)
  const lag = minutesAgo > 0 ? `-m${String(minutesAgo).padStart(2, '0')}m` : ''
  const layer = `nexrad-n0q-900913${lag}-${code}`
  return `${IEM_NEXRAD_ROOT}?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=${encodeURIComponent(layer)}`
    + '&STYLES=&FORMAT=image%2Fpng&TRANSPARENT=true&SRS=EPSG:3857'
    + '&WIDTH=256&HEIGHT=256&BBOX={bbox-epsg-3857}'
}

export function stormLoopLabel(minutesAgo: number) {
  return minutesAgo > 0 ? `${minutesAgo} min ago` : 'latest frame'
}

export function buildProductTileUrl(region: string, product: string, cacheBust: number | string) {
  const layer = `${region}_${product}`
  return `${SERVICE_ROOT}/${region}/${layer}/ows`
    + `?service=WMS&version=1.1.1&request=GetMap&layers=${encodeURIComponent(layer)}`
    + '&styles=&format=image%2Fpng&transparent=true&srs=EPSG%3A3857'
    + '&width=256&height=256&bbox={bbox-epsg-3857}'
    + `&_=${encodeURIComponent(String(cacheBust))}`
}

export function loadRadarLayerPrefs(): RadarLayerPrefs {
  if (typeof window === 'undefined') return { ...DEFAULT_RADAR_LAYER_PREFS }
  try {
    const raw = window.localStorage.getItem(RADAR_PREFS_KEY)
    if (!raw) return { ...DEFAULT_RADAR_LAYER_PREFS }
    const parsed = JSON.parse(raw) as Partial<RadarLayerPrefs>
    return {
      ...DEFAULT_RADAR_LAYER_PREFS,
      ...parsed,
      radarOpacity: clampOpacity(parsed.radarOpacity ?? DEFAULT_RADAR_LAYER_PREFS.radarOpacity),
      alertsOpacity: clampOpacity(parsed.alertsOpacity ?? DEFAULT_RADAR_LAYER_PREFS.alertsOpacity),
    }
  } catch {
    return { ...DEFAULT_RADAR_LAYER_PREFS }
  }
}

export function saveRadarLayerPrefs(prefs: RadarLayerPrefs) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(RADAR_PREFS_KEY, JSON.stringify(prefs))
}

function clampOpacity(value: number) {
  if (!Number.isFinite(value)) return 0.8
  return Math.min(1, Math.max(0.15, value))
}
