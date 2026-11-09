'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { smartBack } from '../../lib/smart-back'
import { createClient } from '../../lib/supabase/client'
import type { GeometrySuggestion } from '../../lib/ai/geometry-contract'
import { calculateCalibratedRoofDraft } from '../../lib/measurements/calibrated-roof-draft'
import { purchasableRoofing, roofAreaRangeError } from '../../lib/measurements/purchasable-roofing'
import RoofSlopeCard from '../../components/RoofSlopeCard'
import AutoMeasurementTool from '../../components/AutoMeasurementTool'

const ManualDrawingTool = dynamic(() => import('../../components/ManualDrawingTool'), { ssr: false })

type Point = { x: number; y: number }
type Plane = { id: string; vertices: Point[]; suggested_pitch: string | null; confidence: string; dbId?: string; review_status?: string }
type Edge = { id: string; start: Point; end: Point; classification: string; confidence: string; dbId?: string; review_status?: string }
type Obj = { id: string; position: Point; type: string; confidence: string; dbId?: string; review_status?: string }
type Suggestion = Omit<GeometrySuggestion, 'planes' | 'edges' | 'objects'> & { planes: Plane[]; edges: Edge[]; objects: Obj[] }
type ReviewKind = 'plane' | 'edge' | 'object'
type ReviewItem = Plane | Edge | Obj

const MIME_EXTENSIONS: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }

export default function MeasurePage() {
  const router = useRouter()
  const supabase = createClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState('')
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 })
  const [address, setAddress] = useState('')
  const [inspectionId, setInspectionId] = useState('')
  const [photoId, setPhotoId] = useState('')
  const [measurementId, setMeasurementId] = useState('')
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [working, setWorking] = useState(false)
  const [scalePixels, setScalePixels] = useState('')
  const [scaleFeet, setScaleFeet] = useState('')
  const [pitchRisePer12, setPitchRisePer12] = useState('')
  const [orthographicTopDown, setOrthographicTopDown] = useState(false)
  const [uniformPitchConfirmed, setUniformPitchConfirmed] = useState(false)
  const [calibrated, setCalibrated] = useState(false)
  const [geometryConfirmed, setGeometryConfirmed] = useState(false)
  const [savedMeasurementId, setSavedMeasurementId] = useState('')
  const [imageryNote, setImageryNote] = useState('')
  const [aerialTileUrl, setAerialTileUrl] = useState('')
  const [aerialAttribution, setAerialAttribution] = useState('')
  const [mapCenter, setMapCenter] = useState<{ latitude: number; longitude: number } | null>(null)
  const [addressCandidates, setAddressCandidates] = useState<Array<{ osmId: string | number | null; buildingType: string; footprintSqFt: number; perimeterFt: number }>>([])
  const [manualMode, setManualMode] = useState(false)
  type ManualArea = { value: number; unit: 'px' | 'sqft'; squareFeet: number | null }
  const [manualArea, setManualArea] = useState<ManualArea | null>(null)
  const [allowSixSquareRepairThreshold, setAllowSixSquareRepairThreshold] = useState(false)
  useEffect(() => {
    const saved = window.localStorage.getItem('roofos.allowSixSquareRepairThreshold')
    if (saved === 'true') setAllowSixSquareRepairThreshold(true)
  }, [])
  function setSixSquareSetting(enabled: boolean) {
    setAllowSixSquareRepairThreshold(enabled)
    window.localStorage.setItem('roofos.allowSixSquareRepairThreshold', enabled ? 'true' : 'false')
  }

  function chooseFile(event: React.ChangeEvent<HTMLInputElement>) {
    const next = event.target.files?.[0] ?? null
    event.target.value = ''
    if (!next || !MIME_EXTENSIONS[next.type]) {
      setError('Choose a JPEG, PNG, or WebP inspection image.')
      return
    }
    if (preview) URL.revokeObjectURL(preview)
    setFile(next)
    setImageSize({ width: 0, height: 0 })
    const imageUrl = URL.createObjectURL(next)
    setPreview(imageUrl)
    setSuggestion(null)
    setInspectionId('')
    setPhotoId('')
    setMeasurementId('')
    setSavedMeasurementId('')
    setCalibrated(false)
    setGeometryConfirmed(false)
    setScalePixels('')
    setScaleFeet('')
    setError('')
    setStatus('')
    const image = new Image()
    image.onload = () => setImageSize({ width: image.naturalWidth, height: image.naturalHeight })
    image.onerror = () => setError('The selected image could not be decoded.')
    image.src = imageUrl
  }

  async function lookupImagery() {
    setWorking(true)
    setError('')
    setMapCenter(null)
    setAerialTileUrl('')
    setAerialAttribution('')
    setManualMode(false)
    setAddressCandidates([])
    setImageryNote('')
    try {
      const { data: workspaceId } = await supabase.rpc('current_workspace_id')
      if (!workspaceId || !address.trim()) throw new Error('An active workspace and property address are required.')
      const response = await fetch(`/api/measurements/property?workspaceId=${encodeURIComponent(workspaceId)}&address=${encodeURIComponent(address.trim())}`, { cache: 'no-store' })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Imagery lookup failed.')
      const validGeocode = Number.isFinite(payload.geocode?.latitude) && Number.isFinite(payload.geocode?.longitude)
      setMapCenter(validGeocode ? { latitude: payload.geocode.latitude, longitude: payload.geocode.longitude } : null)
      const candidates = Array.isArray(payload.candidates) ? payload.candidates : []
      setAddressCandidates(candidates)
      setManualArea(null)
      const aerial = payload.aerial
      const available = validGeocode && aerial?.status === 'available' && typeof aerial.tileUrl === 'string'
      setAerialTileUrl(available ? aerial.tileUrl : '')
      setAerialAttribution(available ? aerial.attribution || 'OpenAerialMap' : '')
      setManualMode(available)
      setImageryNote(available
        ? 'Openly licensed aerial image found. Trace the roof boundary on the imagery; verify pitch and edges before estimating.'
        : candidates.length
          ? `Address located. ${candidates.length} mapped building footprint(s) found. No photo upload is required to view them.`
          : `AERIAL IMAGERY UNAVAILABLE: ${aerial?.reason || 'No qualifying open aerial image found.'}`)
    } catch (err) {
      setMapCenter(null)
      setAerialTileUrl('')
      setAerialAttribution('')
      setManualMode(false)
      setAddressCandidates([])
      setImageryNote('')
      setError(err instanceof Error ? err.message : 'Imagery lookup failed.')
    } finally {
      setWorking(false)
    }
  }

  async function uploadAndAnalyze() {
    if (!file || !imageSize.width || !imageSize.height) {
      setError('Select an actual inspection or aerial image first.')
      return
    }
    if (file.size > 12 * 1024 * 1024) {
      setError('For automatic roof detection, choose an image under 12 MB. Manual tracing can still use larger images.')
      return
    }
    setWorking(true)
    setError('')
    setStatus('Saving the roof photo to private inspection storage before AI analysis…')
    try {

      const { data: { user } } = await supabase.auth.getUser()
      const { data: workspaceId } = await supabase.rpc('current_workspace_id')
      if (!user || !workspaceId) throw new Error('Sign in with an active workspace before saving this image.')

      const { data: inspection, error: inspectionError } = await supabase
        .from('inspection_sessions')
        .insert({ workspace_id: workspaceId, created_by: user.id, status: 'in_progress' })
        .select('id')
        .single()
      if (inspectionError || !inspection) throw new Error('Could not create an inspection session.')

      const objectId = crypto.randomUUID()
      const extension = MIME_EXTENSIONS[file.type]
      const path = `${workspaceId}/${user.id}/${inspection.id}/${objectId}.${extension}`
      const { error: uploadError } = await supabase.storage.from('inspection-photos').upload(path, file, { contentType: file.type, upsert: false })
      if (uploadError) throw new Error('The analyzed image could not be uploaded to private inspection storage.')
      const { error: metadataError } = await supabase.from('inspection_photos').insert({
        id: objectId,
        inspection_id: inspection.id,
        workspace_id: workspaceId,
        uploaded_by: user.id,
        bucket_id: 'inspection-photos',
        object_path: path,
        mime_type: file.type,
        file_size_bytes: file.size,
        upload_status: 'uploaded',
      })
      if (metadataError) throw new Error('The image metadata could not be saved.')

      setInspectionId(inspection.id)
      setPhotoId(objectId)
      setStatus('Sending the private roof photo to Google Gemini for roof-shape suggestions…')
      const aiResponse = await fetch('/api/measurements/aerial/ai-suggest', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ photoId: objectId, inspectionId: inspection.id, imageWidth: imageSize.width, imageHeight: imageSize.height }),
      })
      const aiPayload = await aiResponse.json().catch(() => null)
      if (!aiResponse.ok || !aiPayload?.suggestion) throw new Error(aiPayload?.error || 'Google Gemini could not suggest roof geometry.')
      const response = await fetch('/api/measurements/aerial', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          photoId: objectId,
          inspectionId: inspection.id,
          imageWidth: imageSize.width,
          imageHeight: imageSize.height,
          suggestion: aiPayload.suggestion,
        }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error || 'Validated local geometry could not be saved.')
      setMeasurementId(payload.measurement.id)
      setSuggestion(payload.suggestion ?? null)
      setCalibrated(false)
      setGeometryConfirmed(false)
      setSavedMeasurementId('')
      setStatus(payload.cached
        ? 'Existing suggestions loaded. Confirmed geometry was not overwritten.'
        : `Google ${aiPayload.model} suggestions saved. Review every shape before calibration and confirmation.`)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Roof AI analysis failed.'
      setError(message)
      setStatus('AI did not complete. Your photo remains private; manual tracing is still available.')
      throw err
    } finally {
      setWorking(false)
    }
  }

  async function review(kind: ReviewKind, item: ReviewItem, action: 'accept' | 'reject' | 'delete' | 'edit', patch: Record<string, unknown> = {}) {
    if (!measurementId || !item.dbId || geometryConfirmed) return
    setWorking(true)
    setError('')
    try {
      const response = await fetch('/api/measurements/aerial', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ aerialMeasurementId: measurementId, kind, suggestionId: item.dbId, action, imageWidth: imageSize.width, imageHeight: imageSize.height, ...patch }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Suggestion update failed.')
      setSuggestion((current) => {
        if (!current) return current
        const property = kind === 'plane' ? 'planes' : kind === 'edge' ? 'edges' : 'objects'
        return {
          ...current,
          [property]: current[property].map((entry) => entry.dbId === item.dbId
            ? { ...entry, ...patch, review_status: action === 'delete' || action === 'reject' ? 'rejected' : action === 'accept' ? 'accepted' : 'edited' }
            : entry),
        }
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Suggestion update failed.')
    } finally {
      setWorking(false)
    }
  }

  async function calibrate() {
    if (!measurementId || geometryConfirmed) return
    setWorking(true)
    setError('')
    try {
      const response = await fetch('/api/measurements/aerial', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'calibrate', aerialMeasurementId: measurementId, scaleReferencePixels: Number(scalePixels), scaleReferenceFeet: Number(scaleFeet) }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Calibration failed.')
      setCalibrated(true)
      setStatus('Human scale reference saved. Review geometry and confirm the image’s top-down scale assumptions before deriving a draft quantity.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Calibration failed.')
    } finally {
      setWorking(false)
    }
  }

  async function confirm() {
    if (!measurementId || !calibrated) return
    setWorking(true)
    setError('')
    try {
      const response = await fetch('/api/measurements/aerial', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'confirm', aerialMeasurementId: measurementId }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Confirmation failed.')
      setGeometryConfirmed(true)
      setStatus('Reviewed geometry confirmed. Draft quantities are still unverified and require an explicit save and independent review.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Confirmation failed.')
    } finally {
      setWorking(false)
    }
  }

  const visiblePlanes = suggestion?.planes.filter((item) => item.review_status !== 'rejected') ?? []
  const pitchValue = pitchRisePer12.trim() === '' ? Number.NaN : Number(pitchRisePer12)
  const draftQuantity = useMemo(() => {
    if (!suggestion || !calibrated || !geometryConfirmed || !orthographicTopDown || !uniformPitchConfirmed || pitchRisePer12.trim() === '') return null
    try {
      return calculateCalibratedRoofDraft({
        planes: suggestion.planes,
        scaleReferencePixels: Number(scalePixels),
        scaleReferenceFeet: Number(scaleFeet),
        pitchRisePer12: pitchValue,
        orthographicTopDownConfirmed: orthographicTopDown,
        uniformPitchConfirmed,
        geometryConfirmed,
      })
    } catch {
      return null
    }
  }, [suggestion, calibrated, geometryConfirmed, orthographicTopDown, uniformPitchConfirmed, pitchRisePer12, pitchValue, scalePixels, scaleFeet])

  async function saveDraftQuantity() {
    if (!draftQuantity || !inspectionId || !measurementId || savedMeasurementId) return
    const rangeError = roofAreaRangeError(draftQuantity.roofAreaSqFt)
    if (rangeError) {
      setError(rangeError)
      return
    }
    setWorking(true)
    setError('')
    try {
      const notes = [
        'UNVERIFIED DRAFT. Derived from locally suggested, human-reviewed geometry; not an authoritative estimate quantity.',
        'Technician attested that the source is a top-down orthographic image and that the scale applies across it.',
        `Scale reference: ${scalePixels} image pixels = ${scaleFeet} feet (${draftQuantity.pixelsPerFoot} px/ft).`,
        `Human-measured uniform roof pitch: ${pitchRisePer12}/12; slope multiplier ${draftQuantity.slopeMultiplier}.`,
        `Derived plan area ${draftQuantity.planAreaSqFt} sq ft; slope-adjusted roof area ${draftQuantity.roofAreaSqFt} sq ft; ${draftQuantity.roofSquares} squares.`,
        'Formula: accepted-plane shoelace pixel area ÷ (pixels per foot squared), multiplied by sqrt(1 + (rise/12)^2).',
      ].join(' ')
      const response = await fetch('/api/measurements/manual', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          inspectionId,
          roofAreaSqft: draftQuantity.roofAreaSqFt,
          roofSquares: purchasableRoofing(draftQuantity.roofAreaSqFt, allowSixSquareRepairThreshold)?.squares ?? draftQuantity.roofSquares,
          allowSixSquareRepairThreshold,
          pitch: `${pitchRisePer12}/12`,
          sourceReference: `aerial-geometry:${measurementId}`,
          notes,
        }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'The unverified draft quantity could not be saved.')
      setSavedMeasurementId(payload.measurement?.id ?? 'saved')
      setStatus('Saved as an unverified draft measurement. It is not authoritative and is not estimate-ready until independently reviewed.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The unverified draft quantity could not be saved.')
    } finally {
      setWorking(false)
    }
  }

  return (
    <main className="space-y-4">
      <div className="mx-auto max-w-[1240px] p-4 pb-16 md:p-6">
        <header className="mb-5">
          <button onClick={() => smartBack(router)} className="mb-2 text-xs text-cyan-300">← Back</button>
          <p className="ops-label">ROOF/OS Phase D · Measurement control</p>
          <h1 className="text-3xl font-black">AI-assisted roof geometry</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-400"><b className="text-white">AI suggests. Human calibrates and confirms.</b> Geometry is not a quantity until the image, scale, pitch, and every suggestion pass the review gates.</p>
        </header>

        <section className="glass rounded-xl p-4">
          <div className="grid gap-3 md:grid-cols-[1fr_auto]">
            <label className="text-sm font-medium text-slate-200">Property address
              <input value={address} onChange={(event) => setAddress(event.target.value)} className="mt-1 w-full rounded-lg border border-white/15 bg-black/25 p-3 text-white placeholder:text-slate-500" placeholder="Enter property address" />
            </label>
            <div className="flex items-end gap-2">
              <label className="flex items-center gap-2 text-xs text-slate-300">
                <input type="checkbox" checked={allowSixSquareRepairThreshold} onChange={(event) => setSixSquareSetting(event.target.checked)} />
                Owner setting: treat under 6sq as repair. Off by default. Full replacement still starts at 10sq.
              </label>
              <button onClick={() => void lookupImagery()} disabled={working} className="rounded-lg border border-white/20 px-3 py-2 text-sm text-slate-200 hover:border-cyan-400/60 disabled:opacity-50">Lookup imagery</button>
              <button onClick={() => void router.push('/photo-estimate')} className="rounded-lg border border-white/20 px-3 py-2 text-sm text-cyan-300">Inspection photos</button>
            </div>
          </div>
          {imageryNote && <p className="mt-3 rounded-lg border border-cyan-400/20 bg-cyan-400/10 p-3 text-xs text-cyan-200">{imageryNote}</p>}
          {addressCandidates.length > 0 && <section className="mt-3 space-y-2" aria-label="Mapped building footprints">
            <h2 className="text-sm font-semibold text-white">Buildings near this address — no photo required</h2>
            {addressCandidates.map((candidate, index) => <div key={`${candidate.osmId ?? 'building'}-${index}`} className="rounded-lg border border-white/15 bg-black/20 p-3 text-sm">
              <p className="font-medium">Building {index + 1} · {candidate.buildingType}</p>
              <p className="text-cyan-200">Mapped ground footprint: {candidate.footprintSqFt.toLocaleString()} sq ft · perimeter: {candidate.perimeterFt.toLocaleString()} ft</p>
              <p className="text-xs text-amber-200">OpenStreetMap, low confidence. Not roof surface area or an estimate-ready quantity. Verify the building, roof outline, overhangs, and pitch before estimating.</p>
            </div>)}
          </section>}

          <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={chooseFile} />
          <div className="mt-4 flex flex-wrap gap-2">
            <button onClick={() => inputRef.current?.click()} className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold text-white">{file ? 'Replace actual image' : 'Load actual aerial / inspection image'}</button>
            <button onClick={() => setManualMode(!manualMode)} className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold text-white">{manualMode ? 'Exit Manual Mode' : 'Manual Measurement'}</button>
          </div>
          {manualMode && <ManualDrawingTool
            imageUrl={preview}
            mapCenter={mapCenter}
            aerialTileUrl={aerialTileUrl}
            aerialAttribution={aerialAttribution}
            imageWidth={imageSize.width || 500}
            imageHeight={imageSize.height || 500}
            scalePixels={Number(scalePixels) || 0}
            scaleFeet={Number(scaleFeet) || 0}
            allowSixSquareRepairThreshold={allowSixSquareRepairThreshold}
            onAreaCalculated={(result) => setManualArea(result)}
          />}
          {manualArea && (() => {
            const feet = manualArea.unit === 'sqft' ? manualArea.value : manualArea.squareFeet
            const rangeError = feet ? roofAreaRangeError(feet) : null
            const order = feet && !rangeError ? purchasableRoofing(feet, allowSixSquareRepairThreshold) : null
            return <p className={`mt-2 rounded p-3 text-sm ${rangeError || order?.jobClass !== 'full-replacement' ? 'border border-amber-400/30 bg-amber-400/10 text-amber-100' : 'border border-cyan-400/20 bg-cyan-400/10 text-cyan-100'}`}>{rangeError
              ? rangeError
              : !order
                ? `Manually traced area: ${Math.round(manualArea.value).toLocaleString()} px². Enter a scale reference to convert to square feet, roofing squares, and whole bundles.`
                : `${manualArea.unit === 'sqft' ? 'Horizontal footprint' : 'Traced area'}: ${order.squareFeet.toFixed(1)} sq ft · order ${order.squaresLabel} squares · ${order.bundles} standard bundles. ${order.jobLabel}`}</p>
          })()}
          <AutoMeasurementTool
            hasImage={Boolean(file && imageSize.width && imageSize.height)}
            working={working}
            onDetect={uploadAndAnalyze}
            onManualFallback={() => {
              setManualArea(null)
              setManualMode(true)
              setStatus(mapCenter ? 'Manual map tracing enabled. The mapped footprint is a ground reference, not roof surface area.' : 'Manual image tracing enabled. Enter a known scale reference before treating traced geometry as dimensions.')
            }}
          />
          {file && <p className="mt-2 text-xs text-slate-400">{file.name} · {imageSize.width}×{imageSize.height}px · local analysis runs before private storage upload.</p>}
          {error && <p className="mt-3 rounded-lg border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-300" role="alert">{error}</p>}
          {status && <p className="mt-3 rounded-lg border border-emerald-400/30 bg-emerald-400/10 p-3 text-sm text-emerald-300" role="status">{status}</p>}
        </section>

        <section className="glass mt-4 rounded-xl p-4"><RoofSlopeCard /></section>

        {preview && <section className="glass mt-4 rounded-xl p-4">
          <div className="relative overflow-hidden rounded-lg border border-white/15 bg-black">
            <img src={preview} alt="Selected actual roof inspection image" className="block max-h-[620px] w-full object-contain" />
            {suggestion && <svg viewBox={`0 0 ${suggestion.image_width} ${suggestion.image_height}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
              <g>
                {visiblePlanes.map((plane) => <polygon key={plane.dbId ?? plane.id} points={plane.vertices.map((point) => `${point.x},${point.y}`).join(' ')} fill="rgba(22,201,255,.18)" stroke="#16c9ff" strokeWidth={Math.max(3, suggestion.image_width / 500)} strokeDasharray="12 8" />)}
                {suggestion.edges.filter((edge) => edge.review_status !== 'rejected').map((edge) => <line key={edge.dbId ?? edge.id} x1={edge.start.x} y1={edge.start.y} x2={edge.end.x} y2={edge.end.y} stroke="#ffbd2e" strokeWidth={Math.max(3, suggestion.image_width / 500)} strokeDasharray="10 6" />)}
                {suggestion.objects.filter((object) => object.review_status !== 'rejected').map((object) => <circle key={object.dbId ?? object.id} cx={object.position.x} cy={object.position.y} r={Math.max(8, suggestion.image_width / 100)} fill="#ff2d42" stroke="white" strokeWidth="3" />)}
              </g>
            </svg>}
          </div>
          {suggestion && <p className="mt-2 text-xs text-slate-400">Dashed cyan polygons = local suggestions · amber lines = suggested edges · red dots = suggested objects. These are not quantities.</p>}
        </section>}

        {suggestion && <section className="mt-4 grid gap-4 lg:grid-cols-3">
          <div className="glass rounded-xl p-4 lg:col-span-2">
            <h2 className="font-semibold">Human review queue</h2>
            <p className="mb-3 text-xs text-slate-400">Accept, reject, or edit every suggestion. AI acceptance is never required. A pending item blocks geometry confirmation.</p>
            {suggestion.planes.map((plane) => <div key={plane.dbId ?? plane.id} className="mb-2 rounded-lg border border-cyan-400/20 bg-cyan-400/10 p-2 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>Plane <b>{plane.id}</b> · {plane.confidence} confidence · {plane.review_status ?? 'pending'}</span>
                <span className="flex gap-1">
                  <button disabled={working || geometryConfirmed} onClick={() => void review('plane', plane, 'accept')} className="rounded bg-emerald-600 px-2 py-1 text-xs text-white disabled:opacity-50">Accept</button>
                  <button disabled={working || geometryConfirmed} onClick={() => void review('plane', plane, 'reject')} className="rounded bg-red-600 px-2 py-1 text-xs text-white disabled:opacity-50">Reject</button>
                  <button disabled={working || geometryConfirmed} onClick={() => void review('plane', plane, 'edit', { pitch: window.prompt('Pitch description (for notes only)', plane.suggested_pitch ?? '') ?? plane.suggested_pitch })} className="rounded border border-white/20 px-2 py-1 text-xs disabled:opacity-50">Edit pitch note</button>
                </span>
              </div>
            </div>)}
            {suggestion.edges.map((edge) => <div key={edge.dbId ?? edge.id} className="mb-2 rounded-lg border border-amber-400/20 bg-amber-400/10 p-2 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>Edge <b>{edge.id}</b> · {edge.classification} · {edge.review_status ?? 'pending'}</span>
                <span className="flex gap-1">
                  <button disabled={working || geometryConfirmed} onClick={() => void review('edge', edge, 'accept')} className="rounded bg-emerald-600 px-2 py-1 text-xs text-white disabled:opacity-50">Accept</button>
                  <button disabled={working || geometryConfirmed} onClick={() => void review('edge', edge, 'reject')} className="rounded bg-red-600 px-2 py-1 text-xs text-white disabled:opacity-50">Reject</button>
                  <button disabled={working || geometryConfirmed} onClick={() => void review('edge', edge, 'edit', { classification: window.prompt('Edge classification', edge.classification) ?? edge.classification })} className="rounded border border-white/20 px-2 py-1 text-xs disabled:opacity-50">Edit type</button>
                </span>
              </div>
            </div>)}
            {suggestion.objects.map((object) => <div key={object.dbId ?? object.id} className="mb-2 rounded-lg border border-red-400/20 bg-red-400/10 p-2 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>Object <b>{object.id}</b> · {object.type} · {object.review_status ?? 'pending'}</span>
                <span className="flex gap-1">
                  <button disabled={working || geometryConfirmed} onClick={() => void review('object', object, 'accept')} className="rounded bg-emerald-600 px-2 py-1 text-xs text-white disabled:opacity-50">Accept</button>
                  <button disabled={working || geometryConfirmed} onClick={() => void review('object', object, 'delete')} className="rounded bg-red-600 px-2 py-1 text-xs text-white disabled:opacity-50">Reject</button>
                </span>
              </div>
            </div>)}
            <button disabled={working || geometryConfirmed} onClick={() => setStatus('Manual geometry remains available through the drawing tool; add missing planes and edges there before confirming.')} className="mt-2 rounded border border-white/25 px-3 py-2 text-sm disabled:opacity-50">Add missing geometry manually</button>
          </div>

          <div className="glass rounded-xl p-4">
            <h2 className="font-semibold">Calibration and confirmation</h2>
            <p className="mt-1 text-xs text-slate-400">Use a known reference visible in the image. The app does not infer scale or pitch.</p>
            <div className="mt-3 grid gap-2">
              <label className="text-xs text-slate-200">Known reference length in image pixels
                <input value={scalePixels} onChange={(event) => setScalePixels(event.target.value)} placeholder="e.g. 240 pixels" inputMode="decimal" type="number" min="0.01" step="0.01" className="mt-1 w-full rounded-lg border border-white/15 bg-black/25 p-2 text-sm" />
              </label>
              <label className="text-xs text-slate-200">Real measured length in feet
                <input value={scaleFeet} onChange={(event) => setScaleFeet(event.target.value)} placeholder="e.g. 20 feet" inputMode="decimal" type="number" min="0.01" step="0.01" className="mt-1 w-full rounded-lg border border-white/15 bg-black/25 p-2 text-sm" />
              </label>
              <button onClick={() => void calibrate()} disabled={working || geometryConfirmed} className="rounded-lg bg-slate-700 px-3 py-2 text-sm text-white disabled:opacity-50">{calibrated ? 'Update scale calibration' : 'Save human scale calibration'}</button>
              <button onClick={() => void confirm()} disabled={working || !calibrated || geometryConfirmed} className="rounded-lg bg-emerald-700 px-3 py-2 text-sm text-white disabled:opacity-50">{geometryConfirmed ? 'Geometry confirmed' : 'Confirm reviewed geometry'}</button>
            </div>
            <p className="mt-3 text-xs text-amber-300">One scale applies only to a top-down orthographic image. Perspective/oblique photos cannot produce reliable area from one scale.</p>
          </div>
        </section>}

        {suggestion && <section className="glass mt-4 rounded-xl border border-amber-400/30 p-4">
          <h2 className="font-semibold">Calibrated draft roof quantity</h2>
          <p className="mt-1 text-xs text-slate-400">Requires confirmed geometry, orthographic top-down attestation, one human-measured scale, and a human-measured uniform pitch for every accepted plane.</p>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <label className="flex items-start gap-2 text-sm text-slate-200">
              <input type="checkbox" checked={orthographicTopDown} onChange={(event) => setOrthographicTopDown(event.target.checked)} className="mt-1" />
              <span>I confirm this image is top-down orthographic/orthomosaic—not a perspective phone photo—and the scale applies uniformly.</span>
            </label>
            <label className="text-sm text-slate-200">Human-measured roof pitch rise per 12 inches of run
              <input value={pitchRisePer12} onChange={(event) => setPitchRisePer12(event.target.value)} type="number" min="0" max="36" step="0.1" placeholder="e.g. 6 for 6/12" className="mt-1 w-full rounded-lg border border-white/15 bg-black/25 p-2" />
              <span className="mt-1 block text-xs text-slate-400">AI pitch notes are ignored for this calculation.</span>
            </label>
          </div>
          <label className="mt-3 flex items-start gap-2 text-sm text-slate-200">
            <input type="checkbox" checked={uniformPitchConfirmed} onChange={(event) => setUniformPitchConfirmed(event.target.checked)} className="mt-1" />
            <span>I measured this pitch and confirm it applies to every accepted roof plane.</span>
          </label>
          {draftQuantity ? <div className="mt-4 rounded-lg border border-cyan-400/25 bg-cyan-400/10 p-3">
            <p className="font-semibold text-cyan-100">Draft only · not estimate-authoritative</p>
            <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
              <div><dt className="text-slate-400">Accepted planes</dt><dd>{draftQuantity.acceptedPlaneCount}</dd></div>
              <div><dt className="text-slate-400">Calibrated plan area</dt><dd>{draftQuantity.planAreaSqFt.toLocaleString()} sq ft</dd></div>
              <div><dt className="text-slate-400">Slope-adjusted roof area</dt><dd>{draftQuantity.roofAreaSqFt.toLocaleString()} sq ft</dd></div>
              <div><dt className="text-slate-400">Order squares</dt><dd>{purchasableRoofing(draftQuantity.roofAreaSqFt, allowSixSquareRepairThreshold)?.squaresLabel ?? draftQuantity.roofSquares}</dd></div>
              <div><dt className="text-slate-400">Standard bundles</dt><dd>{purchasableRoofing(draftQuantity.roofAreaSqFt, allowSixSquareRepairThreshold)?.bundles ?? Math.ceil(draftQuantity.roofSquares * 3)} whole bundles</dd></div>
              <div><dt className="text-slate-400">Job class</dt><dd>{purchasableRoofing(draftQuantity.roofAreaSqFt, allowSixSquareRepairThreshold)?.jobLabel ?? 'Full replacement starts at 10 squares.'}</dd></div>
              <div><dt className="text-slate-400">Measured pitch</dt><dd>{draftQuantity.pitchRisePer12}/12</dd></div>
              <div><dt className="text-slate-400">Slope multiplier</dt><dd>{draftQuantity.slopeMultiplier}</dd></div>
            </dl>
            <p className="mt-2 text-xs text-amber-200">Plan area is computed from accepted polygon coordinates and one scale; slope area applies one pitch to all accepted planes. Verify edges, dormers, overhangs, valleys, and plane-specific pitch independently.</p>
            <button onClick={() => void saveDraftQuantity()} disabled={working || Boolean(savedMeasurementId)} className="mt-3 rounded-lg bg-cyan-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{savedMeasurementId ? 'Saved as unverified draft' : 'Save as unverified draft measurement'}</button>
            {savedMeasurementId && <p className="mt-2 text-xs text-emerald-200">Measurement record: {savedMeasurementId}</p>}
          </div> : <p className="mt-3 rounded-lg border border-white/10 bg-black/20 p-3 text-sm text-slate-400">No quantity yet. Confirm geometry, calibration, top-down image type, measured pitch, and uniform pitch across accepted planes; accept or edit at least one plane.</p>}
        </section>}

        {!suggestion && <section className="glass mt-4 rounded-xl border-dashed p-4 text-sm text-slate-400">Manual measurement remains available even when local imagery or vision is unavailable. No fabricated image, geometry, scale, or measurement is shown.</section>}
      </div>
    </main>
  )
}
