import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Linking,
  Modal,
  Platform,
  Pressable,
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

function radarRegion(latitude: number, longitude: number): string | null {
  if (latitude >= 50 && latitude <= 73 && longitude >= -180 && longitude <= -129) return 'alaska'
  if (latitude >= 18 && latitude <= 23.5 && longitude >= -161 && longitude <= -154) return 'hawaii'
  if (latitude >= 17 && latitude <= 20 && longitude >= -69 && longitude <= -64) return 'carib'
  if (latitude >= 12.5 && latitude <= 14 && longitude >= 144 && longitude <= 146) return 'guam'
  if (latitude >= 24 && latitude <= 50 && longitude >= -125 && longitude <= -66) return 'conus'
  return null
}

function buildRadarHtml(coords: Coords, opacity: number, refreshKey: number) {
  const { latitude, longitude } = coords
  const region = radarRegion(latitude, longitude) ?? 'conus'
  const layer = `${region}_bref_qcd`
  const wms =
    `https://opengeo.ncep.noaa.gov/geoserver/${region}/${layer}/ows`
      + `?service=WMS&version=1.1.1&request=GetMap&layers=${encodeURIComponent(layer)}`
      + '&styles=&format=image%2Fpng&transparent=true&srs=EPSG%3A3857'
      + '&width=256&height=256&bbox={bbox-epsg-3857}'
      + `&_=${refreshKey}`

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <link href="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css" rel="stylesheet" />
  <style>
    html, body, #map { margin: 0; padding: 0; height: 100%; width: 100%; background: #050914; }
    .maplibregl-ctrl-attrib { font-size: 10px; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js"><\/script>
  <script>
    const map = new maplibregl.Map({
      container: 'map',
      style: 'https://tiles.openfreemap.org/styles/dark',
      center: [${longitude}, ${latitude}],
      zoom: 7.2,
      minZoom: 3,
      maxZoom: 14,
      attributionControl: true
    });
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), 'top-right');
    map.on('load', () => {
      map.addSource('noaa-mrms-radar', {
        type: 'raster',
        tiles: [${JSON.stringify(wms)}],
        tileSize: 256,
        attribution: 'Radar: NOAA/NWS MRMS'
      });
      const firstLabel = map.getStyle().layers.find((l) => l.type === 'symbol');
      map.addLayer({
        id: 'noaa-mrms-reflectivity',
        type: 'raster',
        source: 'noaa-mrms-radar',
        paint: { 'raster-opacity': ${opacity}, 'raster-fade-duration': 150 }
      }, firstLabel && firstLabel.id);
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
    });
  <\/script>
</body>
</html>`
}

export default function RadarCinema({ visible, onClose, webAppUrl }: Props) {
  const [coords, setCoords] = useState<Coords | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [opacity, setOpacity] = useState(0.82)
  const [refreshKey, setRefreshKey] = useState(0)
  const [hud, setHud] = useState(true)

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
    () => (coords ? buildRadarHtml(coords, opacity, refreshKey) : ''),
    [coords, opacity, refreshKey],
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
                Open the immersive NOAA radar page in the browser for the full cinema experience on web.
              </Text>
              <Pressable style={styles.primary} onPress={() => void openWebFallback()}>
                <Text style={styles.primaryText}>Open web radar</Text>
              </Pressable>
            </View>
          ) : (
            <WebView
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
              <Text style={styles.title}>NOAA MRMS reflectivity</Text>
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

        {hud && coords && (
          <View style={styles.hudBottom}>
            <Text style={styles.hint}>Pinch to zoom · drag to pan · not a damage assessment</Text>
            <View style={styles.opacityRow}>
              <Text style={styles.hint}>Opacity</Text>
              <Pressable style={styles.chip} onPress={() => setOpacity((v) => Math.max(0.35, Number((v - 0.1).toFixed(2))))}>
                <Text style={styles.chipText}>−</Text>
              </Pressable>
              <Text style={styles.opacityValue}>{Math.round(opacity * 100)}%</Text>
              <Pressable style={styles.chip} onPress={() => setOpacity((v) => Math.min(1, Number((v + 0.1).toFixed(2))))}>
                <Text style={styles.chipText}>+</Text>
              </Pressable>
            </View>
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
    gap: 8,
  },
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
  opacityRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
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
