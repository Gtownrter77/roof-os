'use client'

import { useEffect, useRef, useState } from 'react'
import { OPENFREEMAP_DARK_STYLE } from '../lib/services/radar-source.mjs'
import {
  RADAR_PRODUCTS,
  buildIemReflectivityTileUrl,
  buildProductTileUrl,
  radarRegionForPoint,
  type RadarLayerPrefs,
} from '../lib/radar/cinema-layers'
import type { WeatherAlert } from '../lib/services/weather'

type Props = {
  latitude: number
  longitude: number
  locationLabel: string
  prefs: RadarLayerPrefs
  refreshKey: string | number
  /** When set, play this NEXRAD frame (minutes before latest) instead of MRMS base reflectivity. */
  loopMinutesAgo?: number | null
  alerts?: WeatherAlert[]
  alertGeoJson?: { type: 'FeatureCollection'; features: Array<{ type: 'Feature'; geometry: unknown; properties?: Record<string, unknown> | null }> } | null
}

export default function RadarCinemaMap({
  latitude,
  longitude,
  locationLabel,
  prefs,
  refreshKey,
  loopMinutesAgo = null,
  alertGeoJson,
}: Props) {
  const container = useRef<HTMLDivElement>(null)
  const mapRef = useRef<import('maplibre-gl').Map | null>(null)
  const [mapError, setMapError] = useState(false)

  // Create map once
  useEffect(() => {
    const node = container.current
    if (!node) return
    let disposed = false
    let map: import('maplibre-gl').Map | undefined
    let onCinemaCommand: ((event: Event) => void) | undefined

    void import('maplibre-gl').then((maplibregl) => {
      if (disposed || !container.current) return
      map = new maplibregl.Map({
        container: node,
        style: OPENFREEMAP_DARK_STYLE,
        center: [longitude, latitude],
        zoom: 7.2,
        // Expand as far as needed for continental storm watch; zoom in for neighborhood detail.
        minZoom: 0,
        maxZoom: 18,
        attributionControl: false,
        cooperativeGestures: false,
      })
      mapRef.current = map
      map.addControl(new maplibregl.NavigationControl({ showCompass: true, visualizePitch: false }), 'top-right')
      map.addControl(new maplibregl.ScaleControl({ maxWidth: 140 }), 'bottom-left')
      map.addControl(new maplibregl.AttributionControl({
        compact: true,
        customAttribution: 'Radar: NOAA/NWS MRMS · Alerts: NWS · Basemap: OpenFreeMap',
      }), 'bottom-right')
      map.on('error', () => {
        if (!disposed) setMapError(true)
      })
      map.on('load', () => {
        map?.resize()
      })

      onCinemaCommand = (event: Event) => {
        const detail = (event as CustomEvent<string>).detail
        if (!map) return
        if (detail === 'expand') {
          // Pull back for continental / multi-state storm watch while staying anchored on the user.
          map.easeTo({ zoom: 3.2, center: [longitude, latitude], duration: 700 })
        } else if (detail === 'expand-max') {
          map.easeTo({ zoom: 1.4, center: [longitude, latitude], duration: 800 })
        } else if (detail === 'localize') {
          map.easeTo({ zoom: 7.2, center: [longitude, latitude], duration: 700 })
        } else if (detail === 'street') {
          map.easeTo({ zoom: 11.5, center: [longitude, latitude], duration: 700 })
        }
      }
      window.addEventListener('roofos-radar-view', onCinemaCommand)
    }).catch(() => {
      if (!disposed) setMapError(true)
    })

    return () => {
      disposed = true
      if (onCinemaCommand) window.removeEventListener('roofos-radar-view', onCinemaCommand)
      map?.remove()
      mapRef.current = null
    }
  }, [latitude, longitude])

  // Sync layers whenever prefs / data change
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const apply = () => {
      const region = radarRegionForPoint(latitude, longitude)
      const firstLabel = map.getStyle().layers?.find((layer) => layer.type === 'symbol')?.id

      // Basemap visibility (non-symbol / symbol split)
      for (const layer of map.getStyle().layers ?? []) {
        if (layer.id.startsWith('roofos-') || layer.id.startsWith('noaa-')) continue
        const isLabel = layer.type === 'symbol'
        if (isLabel) {
          map.setLayoutProperty(layer.id, 'visibility', prefs.basemapLabels && prefs.basemap ? 'visible' : 'none')
        } else {
          map.setLayoutProperty(layer.id, 'visibility', prefs.basemap ? 'visible' : 'none')
        }
      }

      for (const product of RADAR_PRODUCTS) {
        const sourceId = `noaa-${product.id}`
        const layerId = `noaa-${product.id}-layer`
        const enabled = Boolean(prefs[product.id]) && Boolean(region) && !(product.id === 'bref' && prefs.stormLoop)

        if (map.getLayer(layerId)) map.removeLayer(layerId)
        if (map.getSource(sourceId)) map.removeSource(sourceId)

        if (!enabled || !region) continue

        map.addSource(sourceId, {
          type: 'raster',
          tiles: [buildProductTileUrl(region, product.product, refreshKey)],
          tileSize: 256,
          attribution: 'Radar: NOAA/NWS MRMS',
        })
        map.addLayer({
          id: layerId,
          type: 'raster',
          source: sourceId,
          paint: {
            'raster-opacity': prefs.radarOpacity,
            'raster-fade-duration': 150,
          },
        }, firstLabel)
      }

      // Alerts
      const alertSourceId = 'roofos-nws-alerts'
      const alertFillId = 'roofos-nws-alerts-fill'
      const alertLineId = 'roofos-nws-alerts-line'
      if (map.getLayer(alertFillId)) map.removeLayer(alertFillId)
      if (map.getLayer(alertLineId)) map.removeLayer(alertLineId)
      if (map.getSource(alertSourceId)) map.removeSource(alertSourceId)

      if (prefs.alerts && alertGeoJson && alertGeoJson.features?.length) {
        map.addSource(alertSourceId, {
          type: 'geojson',
          // NWS alert geometries vary; MapLibre accepts the FeatureCollection at runtime.
          data: alertGeoJson as never,
        })
        map.addLayer({
          id: alertFillId,
          type: 'fill',
          source: alertSourceId,
          paint: {
            'fill-color': '#f59e0b',
            'fill-opacity': prefs.alertsOpacity,
          },
        })
        map.addLayer({
          id: alertLineId,
          type: 'line',
          source: alertSourceId,
          paint: {
            'line-color': '#fbbf24',
            'line-width': 2,
          },
        })
      }

      // Location pin
      const pinSource = 'roofos-service-location'
      const pinLayer = 'roofos-service-location-point'
      if (map.getLayer(pinLayer)) map.removeLayer(pinLayer)
      if (map.getSource(pinSource)) map.removeSource(pinSource)
      if (prefs.locationPin) {
        map.addSource(pinSource, {
          type: 'geojson',
          data: {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [longitude, latitude] },
            properties: { label: locationLabel },
          },
        })
        map.addLayer({
          id: pinLayer,
          type: 'circle',
          source: pinSource,
          paint: {
            'circle-radius': 7,
            'circle-color': '#ff3b4f',
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff',
          },
        })
      }
    }

    if (map.isStyleLoaded()) apply()
    else map.once('load', apply)
  }, [prefs, refreshKey, latitude, longitude, locationLabel, alertGeoJson])

  // Swap only the loop frame so the rest of the map does not rebuild every step.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const sourceId = 'iem-n0q-loop'
    const layerId = 'iem-n0q-loop-layer'

    const applyLoop = () => {
      const region = radarRegionForPoint(latitude, longitude)
      const show = prefs.stormLoop && loopMinutesAgo != null && Boolean(region)
      if (!show || !region || loopMinutesAgo == null) {
        if (map.getLayer(layerId)) map.removeLayer(layerId)
        if (map.getSource(sourceId)) map.removeSource(sourceId)
        return
      }
      const url = buildIemReflectivityTileUrl(region, loopMinutesAgo)
      const existing = map.getSource(sourceId) as { setTiles?: (tiles: string[]) => void } | undefined
      if (existing?.setTiles) {
        existing.setTiles([url])
        if (map.getLayer(layerId)) {
          map.setPaintProperty(layerId, 'raster-opacity', prefs.radarOpacity)
        }
        return
      }
      const firstLabel = map.getStyle().layers?.find((layer) => layer.type === 'symbol')?.id
      map.addSource(sourceId, {
        type: 'raster',
        tiles: [url],
        tileSize: 256,
        attribution: 'Radar loop: Iowa State IEM NEXRAD',
      })
      map.addLayer({
        id: layerId,
        type: 'raster',
        source: sourceId,
        paint: {
          'raster-opacity': prefs.radarOpacity,
          'raster-fade-duration': 80,
        },
      }, firstLabel)
    }

    if (map.isStyleLoaded()) applyLoop()
    else map.once('load', applyLoop)
  }, [prefs.stormLoop, prefs.radarOpacity, loopMinutesAgo, latitude, longitude])

  return (
    <div className="relative h-full w-full bg-black">
      <div
        ref={container}
        className="absolute inset-0"
        role="img"
        aria-label={`Radar cinema map near ${locationLabel}`}
      />
      {/* Center crosshair */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden>
        <div className="h-8 w-8 rounded-full border border-white/30">
          <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-white/25" />
          <div className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-white/25" />
        </div>
      </div>
      {mapError && (
        <div className="absolute inset-x-4 bottom-24 z-10 rounded-lg bg-slate-950/90 p-3 text-xs text-amber-100" role="status">
          Map tiles failed to load. Layer toggles are unchanged; try Refresh or check network.
        </div>
      )}
    </div>
  )
}
