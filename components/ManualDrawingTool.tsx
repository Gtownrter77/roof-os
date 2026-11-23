'use client'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import { MapContainer, ImageOverlay, Polygon, TileLayer, useMapEvents } from 'react-leaflet'
import { analyzeTracedPolygon, aggregateTracePlanes, type TracePoint } from '../lib/measurements/trace-geometry'
import 'leaflet/dist/leaflet.css'

type ManualResult = { value: number; unit: 'px' | 'sqft'; squareFeet: number | null }
const CLEARED: ManualResult = { value: 0, unit: 'px', squareFeet: null }

function MapEvents({ isDrawing, addPoint }: { isDrawing: boolean; addPoint: (point: TracePoint) => void }) {
  useMapEvents({ click(e) { if (isDrawing) addPoint([e.latlng.lat, e.latlng.lng]) } })
  return null
}

const ManualDrawingTool = ({
  imageUrl = '', imageWidth = 500, imageHeight = 500,
  scalePixels = 0, scaleFeet = 0, onAreaCalculated, onPlanesChange,
  mapCenter, aerialTileUrl, aerialAttribution,
}: {
  imageUrl?: string
  imageWidth?: number
  imageHeight?: number
  scalePixels?: number
  scaleFeet?: number
  onAreaCalculated?: (result: ManualResult) => void
  onPlanesChange?: (planes: Array<Array<{ x: number; y: number }>>) => void
  mapCenter?: { latitude: number; longitude: number } | null
  aerialTileUrl?: string
  aerialAttribution?: string
  allowSixSquareRepairThreshold?: boolean
}) => {
  const [points, setPoints] = useState<TracePoint[]>([])
  const [planes, setPlanes] = useState<TracePoint[][]>([])
  const [isDrawing, setIsDrawing] = useState(false)
  const [message, setMessage] = useState('')
  const [showLabels, setShowLabels] = useState(true)
  const useGeoMap = !imageUrl && Boolean(mapCenter)
  const units = useGeoMap ? 'geographic' as const : 'pixels' as const
  const aggregate = useMemo(() => aggregateTracePlanes(planes, units), [planes, units])
  const draft = useMemo(() => analyzeTracedPolygon(points, units), [points, units])
  const width = Math.max(1, imageWidth)
  const height = Math.max(1, imageHeight)
  const bounds = useMemo(() => [[0, 0], [height, width]] as [[number, number], [number, number]], [height, width])
  const hasScale = Number.isFinite(scalePixels) && Number.isFinite(scaleFeet) && scalePixels > 0 && scaleFeet > 0
  const pxPerFoot = hasScale ? scalePixels / scaleFeet : 0
  const squareFeet = aggregate.valid ? (useGeoMap ? aggregate.area : hasScale ? aggregate.area / (pxPerFoot * pxPerFoot) : null) : null
  const perimeterFeet = aggregate.valid ? (useGeoMap ? aggregate.perimeter : hasScale ? aggregate.perimeter / pxPerFoot : null) : null

  // TracePoint is [y,x] in ImageOverlay bounds [[0,0],[height,width]].
  // Callers that persist a hand trace need image-pixel {x,y} vertices instead.
  const toPixelPlanes = (source: TracePoint[][]) => source.map((plane) => plane.map((point) => ({ x: point[1], y: point[0] })))

  // A new image invalidates every finished polygon. Reset and tell the parent
  // immediately so it can never POST stale vertices against the wrong photo.
  const imageKey = imageUrl || `${mapCenter?.latitude},${mapCenter?.longitude}:${aerialTileUrl || 'street-map'}`
  const lastImageKey = useRef(imageKey)
  useEffect(() => {
    if (lastImageKey.current === imageKey) return
    lastImageKey.current = imageKey
    setPoints([])
    setPlanes([])
    setIsDrawing(false)
    onPlanesChange?.([])
    onAreaCalculated?.(CLEARED)
  // React to a new drawing surface only, not to parent callback identity.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageKey])

  // Completed plane edits and scale changes automatically recalculate plan area.
  // All values stay provisional and are never presented as certified roof quantities.
  useEffect(() => {
    if (!aggregate.valid) { onAreaCalculated?.(CLEARED); return }
    onAreaCalculated?.(useGeoMap
      ? { value: aggregate.area, unit: 'sqft', squareFeet: aggregate.area }
      : { value: aggregate.area, unit: 'px', squareFeet })
  // React to geometry/scale and NOT the parent callback identity.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aggregate, useGeoMap, squareFeet])

  function addPoint(point: TracePoint) {
    if (planes.length >= 50 || points.length >= 200) {
      setMessage('Maximum of 50 completed planes or 200 corners per plane.'); return
    }
    setPoints(current => [...current, point])
    setMessage('')
  }

  function finishPlane() {
    const result = analyzeTracedPolygon(points, units)
    if (!result.valid) { setMessage(result.warning || 'Roof plane has invalid geometry.'); return }
    if (planes.length >= 50) { setMessage('Maximum 50 roof planes per draft.'); return }
    const combined = aggregateTracePlanes([...planes, points], units)
    if (!combined.valid) { setMessage(combined.warning || 'Roof planes must not overlap.'); return }
    setPlanes((current) => {
      const next = [...current, [...points]]
      onPlanesChange?.(toPixelPlanes(next))
      return next
    })
    setPoints([])
    setMessage('Roof plane added. Trace the next plane or review the provisional total.')
  }

  function removePlane(index: number) {
    setPlanes((current) => {
      const next = current.filter((_, i) => i !== index)
      onPlanesChange?.(toPixelPlanes(next))
      return next
    })
    setMessage('Completed plane removed. Draft totals recalculated.')
  }

  function undoCorner() {
    setPoints(current => current.slice(0, -1))
    onPlanesChange?.(toPixelPlanes(planes))
    setMessage('')
  }

  function clearAll() {
    setPoints([])
    setPlanes([])
    setIsDrawing(false)
    onPlanesChange?.([])
    setMessage('All draft geometry cleared.')
    onAreaCalculated?.(CLEARED)
  }

  return (
    <section className="mt-3 w-full space-y-3" aria-label="Manual roof-plane tracer">
      <div className="rounded-lg border border-cyan-300/20 p-3 text-sm text-slate-200">
        <h3 className="font-semibold text-white">Manual roof-plane tracing · multiple planes</h3>
        <p className="mt-1 text-xs text-slate-300">Tap Start Drawing, then tap each roof corner (or click with a mouse), and Finish plane. Repeat for dormers and separate sections. Do not overlap planes or count an area twice.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setIsDrawing(current => !current)}
          className="rounded bg-cyan-700 px-3 py-2 text-sm font-semibold text-white">
          {isDrawing ? 'Stop Drawing' : 'Start Drawing'}
        </button>
        <button type="button" onClick={finishPlane} disabled={points.length < 3}
          className="rounded bg-emerald-700 px-3 py-2 text-sm text-white disabled:opacity-40">Finish plane</button>
        <button type="button" onClick={undoCorner} disabled={points.length === 0}
          className="rounded border border-white/25 px-3 py-2 text-sm text-slate-100 disabled:opacity-40">Undo corner</button>
        <button type="button" onClick={() => removePlane(planes.length - 1)} disabled={planes.length === 0 || points.length > 0}
          className="rounded border border-white/25 px-3 py-2 text-sm text-slate-100 disabled:opacity-40">Undo finished plane</button>
        <button type="button" onClick={clearAll} disabled={points.length === 0 && planes.length === 0}
          className="rounded border border-white/25 px-3 py-2 text-sm text-slate-100 disabled:opacity-40">Clear all</button>
        <label className="flex items-center gap-2 text-xs text-slate-300">
          <input type="checkbox" checked={showLabels} onChange={event => setShowLabels(event.target.checked)} /> Show plane summary
        </label>
      </div>
      {(imageUrl || mapCenter) ? (
        <div className="h-[420px] w-full overflow-hidden rounded-lg border border-white/15">
          <MapContainer
            key={imageUrl || `${mapCenter?.latitude},${mapCenter?.longitude}:${aerialTileUrl || 'street-map'}`}
            crs={imageUrl ? L.CRS.Simple : L.CRS.EPSG3857}
            {...(imageUrl
              ? { bounds, maxBounds: bounds, zoomSnap: 0.25 }
              : { center: [mapCenter!.latitude, mapCenter!.longitude] as [number, number], zoom: aerialTileUrl ? 20 : 19, maxZoom: 22 })}
            className="h-full w-full" style={{ height: '100%', width: '100%', background: '#000' }}
          >
            {imageUrl
              ? <ImageOverlay url={imageUrl} bounds={bounds} />
              : aerialTileUrl
                ? <TileLayer url={aerialTileUrl} attribution={aerialAttribution || 'OpenAerialMap'} maxZoom={22} maxNativeZoom={19} />
                : <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution="© OpenStreetMap contributors · street map, NOT aerial imagery" maxZoom={22} maxNativeZoom={19} />}
            <MapEvents isDrawing={isDrawing} addPoint={addPoint} />
            {planes.map((plane, index) => <Polygon key={index} positions={plane} pathOptions={{ color: '#10b981', weight: 3, fillOpacity: 0.16 }} />)}
            {points.length >= 2 && <Polygon positions={points} pathOptions={{ color: '#16c9ff', weight: 2, dashArray: '6,6', fillOpacity: 0.06 }} />}
          </MapContainer>
        </div>
      ) : <p className="text-sm text-slate-300">Enter a property address and select Lookup imagery, or load an image to trace manually.</p>}
      {useGeoMap && !aerialTileUrl && <p className="text-xs text-amber-200">OpenStreetMap STREET MAP fallback — NOT aerial imagery. Street-map roof outlines are not verified.</p>}
      {message && <p role="status" className="rounded border border-cyan-400/20 p-2 text-xs text-cyan-200">{message}</p>}
      {points.length > 0 && <p className="text-xs text-amber-200" role="status">
        Active plane: {points.length} corners. {points.length >= 3 && draft.warning ? draft.warning : 'Finish plane to include it in provisional totals.'}
      </p>}
      {showLabels && <div className="space-y-2 rounded-lg border border-white/15 p-3">
        <h4 className="text-sm font-semibold">Completed planes ({planes.length})</h4>
        {planes.length === 0 && <p className="text-xs text-slate-400">No finished planes yet. Tap each corner then Finish plane.</p>}
        {planes.map((plane, index) => {
          const result = analyzeTracedPolygon(plane, units)
          return <div key={index} className="flex items-center justify-between gap-2 text-xs text-slate-300">
            <p>Plane {index + 1}: {result.area.toFixed(1)} {useGeoMap ? 'sq ft ground' : 'px² plan'} · {result.perimeter.toFixed(1)} {useGeoMap ? 'ft perimeter' : 'px perimeter'} · {plane.length} corners</p>
            <button type="button" onClick={() => removePlane(index)} className="rounded border border-white/20 px-2 py-1 text-amber-200">Remove</button>
          </div>
        })}
      </div>}
      <div className="rounded-lg border border-amber-300/25 bg-amber-300/5 p-3 text-sm text-amber-100">
        <p className="font-semibold">Provisional horizontal footprint only — Not a material order.</p>
        <p className="mt-1">
          {aggregate.valid
            ? `${aggregate.planeCount} planes · ${squareFeet != null ? squareFeet.toFixed(1) + ' sq ft plan area' : aggregate.area.toFixed(1) + ' px² unscaled'} · ${perimeterFeet != null ? perimeterFeet.toFixed(1) + ' ft external plan perimeter (not gutter length)' : 'scale reference needed for lengths'}`
            : aggregate.warning || 'Finish at least one valid roof-plane polygon to calculate provisional plan area.'}
        </p>
        <p className="mt-1 text-xs">Overlapping planes are blocked and shared internal edges excluded from the external plan perimeter. This perimeter is NOT the gutter or eave length. Verify pitch, overhangs, calibration and edge classification before estimating.</p>
      </div>
    </section>
  )
}
export default ManualDrawingTool
