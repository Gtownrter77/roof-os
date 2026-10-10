'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { buildRadarWmsTileTemplate, getRadarServiceForPoint, OPENFREEMAP_DARK_STYLE } from '../lib/services/radar-source.mjs'

type Props = {
  latitude: number
  longitude: number
  locationLabel: string
  className?: string
  interactive?: boolean
  showBadge?: boolean
  refreshKey?: string
  /** Initial map zoom. Immersive watch mode likes ~6.5–8. */
  zoom?: number
  /** Radar layer opacity 0–1. */
  opacity?: number
  /** Drop rounded chrome for true edge-to-edge cinema. */
  edgeToEdge?: boolean
}

export default function WeatherRadarMap({
  latitude,
  longitude,
  locationLabel,
  className = 'h-72',
  interactive = true,
  showBadge = true,
  refreshKey,
  zoom = 7,
  opacity = 0.78,
  edgeToEdge = false,
}: Props) {
  const container = useRef<HTMLDivElement>(null)
  const [mapError, setMapError] = useState(false)
  const radar = useMemo(() => getRadarServiceForPoint(latitude, longitude), [latitude, longitude])
  const radarTiles = useMemo(() => buildRadarWmsTileTemplate(radar), [radar])

  useEffect(() => {
    const node = container.current
    if (!node) return
    let disposed = false
    let map: import('maplibre-gl').Map | undefined
    setMapError(false)

    void import('maplibre-gl').then((maplibregl) => {
      if (disposed || !container.current) return
      map = new maplibregl.Map({
        container: node,
        style: OPENFREEMAP_DARK_STYLE,
        center: [longitude, latitude],
        zoom,
        minZoom: 3,
        maxZoom: 14,
        interactive,
        attributionControl: false,
        cooperativeGestures: interactive && !edgeToEdge,
      })
      if (interactive) {
        map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-right')
        map.addControl(new maplibregl.AttributionControl({
          compact: true,
          customAttribution: 'Radar: NOAA/NWS MRMS · Basemap: OpenFreeMap · © OpenStreetMap contributors',
        }), 'bottom-right')
      }

      map.on('load', () => {
        if (!map) return
        if (radarTiles && radar) {
          map.addSource('noaa-mrms-radar', {
            type: 'raster',
            tiles: [radarTiles],
            tileSize: 256,
            attribution: radar.attribution,
          })
          const firstLabel = map.getStyle().layers?.find((layer) => layer.type === 'symbol')?.id
          map.addLayer({
            id: 'noaa-mrms-reflectivity',
            type: 'raster',
            source: 'noaa-mrms-radar',
            paint: { 'raster-opacity': opacity, 'raster-fade-duration': 150 },
          }, firstLabel)
        }
        map.addSource('roofos-service-location', {
          type: 'geojson',
          data: {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [longitude, latitude] },
            properties: { label: locationLabel },
          },
        })
        map.addLayer({
          id: 'roofos-service-location-point',
          type: 'circle',
          source: 'roofos-service-location',
          paint: {
            'circle-radius': 7,
            'circle-color': '#ff3b4f',
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff',
          },
        })
        // Cinema: fill the container after chrome settles
        map.resize()
      })
      map.on('error', () => {
        if (!disposed) setMapError(true)
      })
    }).catch(() => {
      if (!disposed) setMapError(true)
    })

    return () => {
      disposed = true
      map?.remove()
    }
  }, [latitude, longitude, locationLabel, radarTiles, radar, interactive, refreshKey, zoom, opacity, edgeToEdge])

  return (
    <div className={`relative overflow-hidden bg-slate-950 ${edgeToEdge ? '' : 'rounded-xl border border-white/10'} ${className}`}>
      <div
        ref={container}
        className="absolute inset-0"
        role="img"
        aria-label={`Interactive weather radar map centered near ${locationLabel}; NOAA MRMS radar overlay where supported.`}
      />
      {showBadge && (
        <div className="pointer-events-none absolute left-3 top-3 z-10 flex items-center gap-2 rounded-full border border-white/15 bg-slate-950/85 px-3 py-1.5 text-xs font-semibold text-white shadow">
          <span className={`h-2 w-2 rounded-full ${radar ? 'bg-emerald-400' : 'bg-amber-400'}`} />
          {radar ? 'NOAA MRMS radar · latest available' : 'Radar coverage unavailable here'}
        </div>
      )}
      {showBadge && mapError && (
        <div className="absolute inset-x-4 bottom-10 z-10 rounded-lg bg-slate-950/90 p-3 text-xs text-amber-100" role="status">
          The map service did not load. Weather figures are kept separate from the map display.
        </div>
      )}
    </div>
  )
}
