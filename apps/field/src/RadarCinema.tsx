import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import * as Location from 'expo-location'
import { WebView } from 'react-native-webview'

type Props = {
  visible: boolean
  onClose: () => void
  webAppUrl: string
}

type Coords = { latitude: number; longitude: number }

type LayerPrefs = {
  bref: boolean
  cref: boolean
  echoTops: boolean
  precipType: boolean
  stormLoop: boolean
  locationPin: boolean
  basemapLabels: boolean
  basemap: boolean
  radarOpacity: number
}

const DEFAULT_PREFS: LayerPrefs = {
  bref: true,
  cref: false,
  echoTops: false,
  precipType: false,
  stormLoop: false,
  locationPin: true,
  basemapLabels: true,
  basemap: true,
  radarOpacity: 0.82,
}

const LAYER_ROWS: Array<{ id: keyof LayerPrefs; label: string }> = [
  { id: 'bref', label: 'Base reflectivity' },
  { id: 'cref', label: 'Composite reflectivity' },
  { id: 'echoTops', label: 'Echo tops' },
  { id: 'precipType', label: 'Precip type' },
  { id: 'stormLoop', label: 'Storm loop · last hour' },
  { id: 'locationPin', label: 'Location pin' },
  { id: 'basemapLabels', label: 'Map labels' },
  { id: 'basemap', label: 'Basemap' },
]

function radarRegion(latitude: number, longitude: number): string {
  if (latitude >= 50 && latitude <= 73 && longitude >= -180 && longitude <= -129) return 'alaska'
  if (latitude >= 18 && latitude <= 23.5 && longitude >= -161 && longitude <= -154) return 'hawaii'
  if (latitude >= 17 && latitude <= 20 && longitude >= -69 && longitude <= -64) return 'carib'
  if (latitude >= 12.5 && latitude <= 14 && longitude >= 144 && longitude <= 146) return 'guam'
  return 'conus'
}

function iemCode(region: string) {
  if (region === 'alaska') return 'ak'
  if (region === 'hawaii') return 'hi'
  if (region === 'guam') return 'gu'
  if (region === 'carib') return 'pr'
  return 'conus'
}

function loopTileUrl(region: string, minutesAgo: number) {
  const lag = minutesAgo > 0 ? `-m${String(minutesAgo).padStart(2, '0')}m` : ''
  const layer = `nexrad-n0q-900913${lag}-${iemCode(region)}`
  return 'https://mesonet.agron.iastate.edu/cgi-bin/wms/nexrad/n0q.cgi'
    + `?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=${encodeURIComponent(layer)}`
    + '&STYLES=&FORMAT=image%2Fpng&TRANSPARENT=true&SRS=EPSG:3857'
    + '&WIDTH=256&HEIGHT=256&BBOX={bbox-epsg-3857}'
}

function tileUrl(region: string, product: string, refreshKey: number) {
  const layer = `${region}_${product}`
  return `https://opengeo.ncep.noaa.gov/geoserver/${region}/${layer}/ows`
    + `?service=WMS&version=1.1.1&request=GetMap&layers=${encodeURIComponent(layer)}`
    + '&styles=&format=image%2Fpng&transparent=true&srs=EPSG%3A3857'
    + '&width=256&height=256&bbox={bbox-epsg-3857}'
    + `&_=${refreshKey}`
}

function buildRadarHtml(coords: Coords, prefs: LayerPrefs, refreshKey: number) {
  const { latitude, longitude } = coords
  const region = radarRegion(latitude, longitude)
  const products = [
    prefs.bref && !prefs.stormLoop ? { id: 'bref', product: 'bref_qcd' } : null,
    prefs.cref ? { id: 'cref', product: 'cref_qcd' } : null,
    prefs.echoTops ? { id: 'echoTops', product: 'neet_v18' } : null,
    prefs.precipType ? { id: 'precipType', product: 'pcpn_typ' } : null,
  ].filter(Boolean) as Array<{ id: string; product: string }>

  const productJs = products.map((item) => ({
    id: item.id,
    url: tileUrl(region, item.product, refreshKey),
  }))
  const loopFrames = [55, 50, 45, 40, 35, 30, 25, 20, 15, 10, 5, 0].map((minutes) => ({
    minutes,
    label: minutes > 0 ? `${minutes} min ago` : 'latest frame',
    url: loopTileUrl(region, minutes),
  }))

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <link href="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css" rel="stylesheet" />
  <style>
    html, body, #map { margin: 0; padding: 0; height: 100%; width: 100%; background: #050914; }
    .maplibregl-ctrl-attrib { font-size: 10px; }
    #loop-readout { position: absolute; left: 12px; bottom: 28px; z-index: 2; color: #e2e8f0; font: 600 12px/1.3 sans-serif; background: rgba(0,0,0,.55); border: 1px solid rgba(255,255,255,.15); border-radius: 999px; padding: 6px 10px; display: none; }
  </style>
</head>
<body>
  <div id="map"></div>
  <div id="loop-readout"></div>
  <script src="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js"><\/script>
  <script>
    const products = ${JSON.stringify(productJs)};
    const loopFrames = ${JSON.stringify(loopFrames)};
    const stormLoop = ${prefs.stormLoop ? 'true' : 'false'};
    const prefs = ${JSON.stringify({
      radarOpacity: prefs.radarOpacity,
      locationPin: prefs.locationPin,
      basemap: prefs.basemap,
      basemapLabels: prefs.basemapLabels,
    })};
    const map = new maplibregl.Map({
      container: 'map',
      style: 'https://tiles.openfreemap.org/styles/dark',
      center: [${longitude}, ${latitude}],
      zoom: 7.2,
      minZoom: 0,
      maxZoom: 18
    });
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), 'top-right');
    map.addControl(new maplibregl.ScaleControl({ maxWidth: 120 }), 'bottom-left');
    window.__roofosRadar = {
      expand: function () { map.easeTo({ zoom: 3.2, center: [${longitude}, ${latitude}], duration: 700 }); },
      expandMax: function () { map.easeTo({ zoom: 1.4, center: [${longitude}, ${latitude}], duration: 800 }); },
      localize: function () { map.easeTo({ zoom: 7.2, center: [${longitude}, ${latitude}], duration: 700 }); }
    };
    map.on('load', () => {
      const layers = map.getStyle().layers || [];
      for (const layer of layers) {
        if (layer.id.startsWith('noaa-') || layer.id.startsWith('you')) continue;
        const isLabel = layer.type === 'symbol';
        map.setLayoutProperty(
          layer.id,
          'visibility',
          isLabel
            ? (prefs.basemap && prefs.basemapLabels ? 'visible' : 'none')
            : (prefs.basemap ? 'visible' : 'none')
        );
      }
      const firstLabel = layers.find((l) => l.type === 'symbol');
      for (const product of products) {
        map.addSource('noaa-' + product.id, {
          type: 'raster',
          tiles: [product.url],
          tileSize: 256,
          attribution: 'Radar: NOAA/NWS MRMS'
        });
        map.addLayer({
          id: 'noaa-' + product.id + '-layer',
          type: 'raster',
          source: 'noaa-' + product.id,
          paint: { 'raster-opacity': prefs.radarOpacity, 'raster-fade-duration': 150 }
        }, firstLabel && firstLabel.id);
      }
      if (stormLoop && loopFrames.length) {
        let frame = 0;
        const readout = document.getElementById('loop-readout');
        map.addSource('iem-loop', {
          type: 'raster',
          tiles: [loopFrames[0].url],
          tileSize: 256,
          attribution: 'Radar loop: Iowa State IEM NEXRAD'
        });
        map.addLayer({
          id: 'iem-loop-layer',
          type: 'raster',
          source: 'iem-loop',
          paint: { 'raster-opacity': prefs.radarOpacity, 'raster-fade-duration': 80 }
        }, firstLabel && firstLabel.id);
        const paint = () => {
          const item = loopFrames[frame];
          const source = map.getSource('iem-loop');
          if (source && source.setTiles) source.setTiles([item.url]);
          if (readout) {
            readout.style.display = 'block';
            readout.textContent = 'Storm loop · ' + item.label;
          }
        };
        paint();
        window.__roofosLoop = setInterval(() => {
          frame = (frame + 1) % loopFrames.length;
          paint();
        }, 800);
      }
      if (prefs.locationPin) {
        map.addSource('you', {
          type: 'geojson',
          data: { type: 'Feature', geometry: { type: 'Point', coordinates: [${longitude}, ${latitude}] }, properties: {} }
        });
        map.addLayer({
          id: 'you-point',
          type: 'circle',
          source: 'you',
          paint: {
            'circle-radius': 7,
            'circle-color': '#ff3b4f',
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff'
          }
        });
      }
    });
  <\/script>
</body>
</html>`
}

export default function RadarCinema({ visible, onClose, webAppUrl }: Props) {
  const webRef = useRef<WebView>(null)
  const [coords, setCoords] = useState<Coords | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [prefs, setPrefs] = useState<LayerPrefs>(DEFAULT_PREFS)
  const [refreshKey, setRefreshKey] = useState(0)
  const [hud, setHud] = useState(true)
  const [layersOpen, setLayersOpen] = useState(true)

  const locate = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const permission = await Location.requestForegroundPermissionsAsync()
      if (!permission.granted) {
        setError('Location permission is required to center NOAA radar on you.')
        return
      }
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      })
      setCoords({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      })
      setRefreshKey((n) => n + 1)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not read device location.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!visible) return
    void locate()
    const id = setInterval(() => setRefreshKey((n) => n + 1), 3 * 60 * 1000)
    return () => clearInterval(id)
  }, [visible, locate])

  const html = useMemo(
    () => (coords ? buildRadarHtml(coords, prefs, refreshKey) : ''),
    [coords, prefs, refreshKey],
  )

  async function openWebFallback() {
    const url = `${webAppUrl.replace(/\/$/, '')}/radar`
    await Linking.openURL(url)
  }

  return (
    <Modal visible={visible} animationType="fade" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={styles.root}>
        {coords && html ? (
          Platform.OS === 'web' ? (
            <View style={styles.webFallback}>
              <Text style={styles.webTitle}>Radar cinema</Text>
              <Text style={styles.webBody}>
                Open the immersive NOAA radar page in the browser for full multi-layer cinema on web.
              </Text>
              <Pressable style={styles.primary} onPress={() => void openWebFallback()}>
                <Text style={styles.primaryText}>Open web radar</Text>
              </Pressable>
            </View>
          ) : (
            <WebView
              ref={webRef}
              originWhitelist={['*']}
              source={{ html }}
              style={styles.map}
              allowFileAccess
              mixedContentMode="always"
              setSupportMultipleWindows={false}
            />
          )
        ) : (
          <View style={styles.center}>
            {loading ? <ActivityIndicator color="#22d3ee" /> : null}
            <Text style={styles.centerTitle}>Radar cinema</Text>
            <Text style={styles.centerBody}>
              {error || 'Finding your location to center NOAA MRMS radar…'}
            </Text>
            <Pressable style={styles.primary} onPress={() => void locate()} disabled={loading}>
              <Text style={styles.primaryText}>{loading ? 'Locating…' : 'Use my location'}</Text>
            </Pressable>
            <Pressable style={styles.secondary} onPress={() => void openWebFallback()}>
              <Text style={styles.secondaryText}>Open web radar instead</Text>
            </Pressable>
          </View>
        )}

        {hud && (
          <View style={styles.hudTop} pointerEvents="box-none">
            <View>
              <Text style={styles.eyebrow}>ROOF/OS FIELD · RADAR CINEMA</Text>
              <Text style={styles.title}>NOAA MRMS multi-layer</Text>
              <Text style={styles.meta}>
                {coords
                  ? `${coords.latitude.toFixed(3)}, ${coords.longitude.toFixed(3)} · auto-refresh 3 min`
                  : 'Location pending'}
              </Text>
            </View>
            <View style={styles.hudActions}>
              <Pressable style={styles.chip} onPress={() => setRefreshKey((n) => n + 1)}>
                <Text style={styles.chipText}>Refresh</Text>
              </Pressable>
              <Pressable style={styles.chip} onPress={() => webRef.current?.injectJavaScript('window.__roofosRadar&&window.__roofosRadar.expand();true;')}>
                <Text style={styles.chipText}>Expand</Text>
              </Pressable>
              <Pressable style={styles.chip} onPress={() => webRef.current?.injectJavaScript('window.__roofosRadar&&window.__roofosRadar.expandMax();true;')}>
                <Text style={styles.chipText}>Max</Text>
              </Pressable>
              <Pressable style={styles.chip} onPress={() => webRef.current?.injectJavaScript('window.__roofosRadar&&window.__roofosRadar.localize();true;')}>
                <Text style={styles.chipText}>Local</Text>
              </Pressable>
              <Pressable style={styles.chip} onPress={() => setLayersOpen((v) => !v)}>
                <Text style={styles.chipText}>Layers</Text>
              </Pressable>
              <Pressable style={styles.chip} onPress={() => void locate()}>
                <Text style={styles.chipText}>Relocate</Text>
              </Pressable>
              <Pressable style={styles.chip} onPress={() => setHud(false)}>
                <Text style={styles.chipText}>Hide</Text>
              </Pressable>
              <Pressable style={[styles.chip, styles.chipExit]} onPress={onClose}>
                <Text style={styles.chipText}>Exit</Text>
              </Pressable>
            </View>
          </View>
        )}

        {hud && layersOpen && (
          <View style={styles.layerPanel}>
            <Text style={styles.layerTitle}>Layers</Text>
            <ScrollView style={{ maxHeight: 280 }}>
              {LAYER_ROWS.map((row) => (
                <Pressable
                  key={row.id}
                  style={styles.layerRow}
                  onPress={() => setPrefs((prev) => ({ ...prev, [row.id]: !prev[row.id] }))}
                >
                  <Text style={styles.layerCheck}>{prefs[row.id] ? 'ON' : 'OFF'}</Text>
                  <Text style={styles.layerLabel}>{row.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <View style={styles.opacityRow}>
              <Text style={styles.hint}>Opacity</Text>
              <Pressable
                style={styles.chip}
                onPress={() => setPrefs((p) => ({
                  ...p,
                  radarOpacity: Math.max(0.2, Number((p.radarOpacity - 0.1).toFixed(2))),
                }))}
              >
                <Text style={styles.chipText}>−</Text>
              </Pressable>
              <Text style={styles.opacityValue}>{Math.round(prefs.radarOpacity * 100)}%</Text>
              <Pressable
                style={styles.chip}
                onPress={() => setPrefs((p) => ({
                  ...p,
                  radarOpacity: Math.min(1, Number((p.radarOpacity + 0.1).toFixed(2))),
                }))}
              >
                <Text style={styles.chipText}>+</Text>
              </Pressable>
            </View>
            <Pressable style={styles.chip} onPress={() => setPrefs({ ...DEFAULT_PREFS })}>
              <Text style={styles.chipText}>Reset defaults</Text>
            </Pressable>
          </View>
        )}

        {hud && coords && !layersOpen && (
          <View style={styles.hudBottom}>
            <Text style={styles.hint}>Pinch to zoom · Layers for bref / cref / echo tops / precip · not a damage assessment</Text>
          </View>
        )}

        {!hud && (
          <Pressable style={styles.showHud} onPress={() => setHud(true)}>
            <Text style={styles.chipText}>Show HUD</Text>
          </Pressable>
        )}
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#050914' },
  map: { flex: 1, backgroundColor: '#050914' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  centerTitle: { color: '#fff', fontSize: 22, fontWeight: '900' },
  centerBody: { color: '#94a3b8', textAlign: 'center', fontSize: 14, lineHeight: 20 },
  webFallback: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  webTitle: { color: '#fff', fontSize: 22, fontWeight: '900' },
  webBody: { color: '#94a3b8', textAlign: 'center', fontSize: 14, lineHeight: 20, maxWidth: 320 },
  primary: {
    backgroundColor: '#22d3ee',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
  },
  primaryText: { color: '#082f49', fontWeight: '800', fontSize: 14 },
  secondary: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
  },
  secondaryText: { color: '#e2e8f0', fontWeight: '700', fontSize: 13 },
  hudTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: Platform.OS === 'ios' ? 54 : 24,
    paddingHorizontal: 16,
    paddingBottom: 20,
    backgroundColor: 'rgba(0,0,0,0.55)',
    gap: 10,
  },
  hudBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 28 : 16,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  layerPanel: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 150 : 120,
    right: 12,
    width: 260,
    maxHeight: '60%',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(2,6,23,0.94)',
    padding: 12,
    gap: 8,
  },
  layerTitle: { color: '#67e8f9', fontWeight: '900', fontSize: 12, letterSpacing: 1, textTransform: 'uppercase' },
  layerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  layerCheck: {
    width: 36,
    textAlign: 'center',
    color: '#22d3ee',
    fontWeight: '900',
    fontSize: 11,
  },
  layerLabel: { color: '#f8fafc', fontSize: 13, fontWeight: '600', flex: 1 },
  eyebrow: { color: '#67e8f9', fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  title: { color: '#fff', fontSize: 18, fontWeight: '900' },
  meta: { color: '#cbd5e1', fontSize: 12, marginTop: 2 },
  hudActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  chipExit: { borderColor: 'rgba(34,211,238,0.5)', backgroundColor: 'rgba(34,211,238,0.15)' },
  chipText: { color: '#f8fafc', fontSize: 12, fontWeight: '700' },
  hint: { color: '#94a3b8', fontSize: 11 },
  opacityRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  opacityValue: { color: '#fff', fontWeight: '800', minWidth: 40, textAlign: 'center' },
  showHud: {
    position: 'absolute',
    left: 16,
    bottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
})
