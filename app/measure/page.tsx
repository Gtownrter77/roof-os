'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { smartBack } from '../../lib/smart-back'
import { createClient } from '../../lib/supabase/client'
import type { GeometrySuggestion } from '../../lib/ai/geometry-contract'
import { analyzeRoofImageWithLocalOllama } from '../../lib/ai/local-vision-browser'
import { calculateCalibratedRoofDraft } from '../../lib/measurements/calibrated-roof-draft'
import { previewRoofAreaFromFootprint } from '../../lib/measurements/footprint-preview'
import { purchasableRoofing, roofAreaRangeError } from '../../lib/measurements/purchasable-roofing'
import RoofSlopeCard from '../../components/RoofSlopeCard'
import AutoMeasurementTool from '../../components/AutoMeasurementTool'
import RoofingWorkflowSettings from '../../components/RoofingWorkflowSettings'
import RoofingWizardNavigator from '../../components/RoofingWizardNavigator'
import { canAutoLookupAddress, loadRoofingWorkflowPreferences, type RoofingWorkflowPreferences, DEFAULT_ROOFING_WORKFLOW_PREFS } from '../../lib/roofing-workflow-preferences'

const ManualDrawingTool = dynamic(() => import('../../components/ManualDrawingTool'), { ssr: false })

type Point = { x: number; y: number }
type Plane = { id: string; vertices: Point[]; suggested_pitch: string | null; confidence: string; dbId?: string; review_status?: string; pitchRisePer12?: number }
type Edge = { id: string; start: Point; end: Point; classification: string; confidence: string; dbId?: string; review_status?: string }
type Obj = { id: string; position: Point; type: string; confidence: string; dbId?: string; review_status?: string }
type Suggestion = Omit<GeometrySuggestion, 'planes' | 'edges' | 'objects'> & { planes: Plane[]; edges: Edge[]; objects: Obj[] }
type ReviewKind = 'plane' | 'edge' | 'object'
type ReviewItem = Plane | Edge | Obj

const MIME_EXTENSIONS: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }

function parsePitchRise(value: string): number | null {
  if (!/^\d+(?:\.\d+)?$/.test(value.trim())) return null
  const rise = Number(value.trim())
  return Number.isFinite(rise) && rise >= 0 && rise <= 36 ? rise : null
}

function reviewedPlanePitch(value: string | null | undefined): number | null {
  // Only owner-reviewed values carry the durable prefix.
  if (typeof value !== 'string' || !/^reviewed:\d+(?:\.\d+)?\/12$/.test(value.trim())) return null
  return parsePitchRise(value.trim().slice('reviewed:'.length).replace(/\/12$/, ''))
}

export default function MeasurePage() {
  const router = useRouter()
  const supabase = createClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState('')
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 })
  const [address, setAddress] = useState('')
  const [automationPrefs, setAutomationPrefs] = useState<RoofingWorkflowPreferences>({ ...DEFAULT_ROOFING_WORKFLOW_PREFS })
  const lookupSeqRef = useRef(0)
  const autoLookupAttemptRef = useRef('')
  useEffect(() => {
    const refresh = () => setAutomationPrefs(loadRoofingWorkflowPreferences())
    refresh()
    window.addEventListener('storage', refresh)
    window.addEventListener('roofos-roofing-preferences-changed', refresh)
    return () => {
      window.removeEventListener('storage', refresh)
      window.removeEventListener('roofos-roofing-preferences-changed', refresh)
    }
  }, [])
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
  const [perPlanePitchMode, setPerPlanePitchMode] = useState(false)
  const [calibrated, setCalibrated] = useState(false)
  const [geometryConfirmed, setGeometryConfirmed] = useState(false)
  const [savedMeasurementId, setSavedMeasurementId] = useState('')
  const [imageryNote, setImageryNote] = useState('')
  const [aerialTileUrl, setAerialTileUrl] = useState('')
  const [aerialAttribution, setAerialAttribution] = useState('')
  const [mapCenter, setMapCenter] = useState<{ latitude: number; longitude: number } | null>(null)
  const [addressCandidates, setAddressCandidates] = useState<Array<{ osmId: string | number | null; buildingType: string; footprintSqFt: number; perimeterFt: number }>>([])
  const [manualMode, setManualMode] = useState(false)
  const [selectedBuildingIndex, setSelectedBuildingIndex] = useState<number | null>(null)
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
    setPerPlanePitchMode(false)
    setUniformPitchConfirmed(false)
    setScalePixels('')
    setScaleFeet('')
    setError('')
    setStatus('')
    const image = new Image()
    image.onload = () => setImageSize({ width: image.naturalWidth, height: image.naturalHeight })
    image.onerror = () => setError('The selected image could not be decoded.')
    image.src = imageUrl
  }

  async function findHouseFromHere() {
    if (!navigator.geolocation) { setError('This device cannot share its location.'); return }
    setWorking(true)
    setError('')
    setStatus('Reading this location, then finding the address…')
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 12000 })
      })
      const { data: workspaceId } = await supabase.rpc('current_workspace_id')
      if (!workspaceId) throw new Error('An active workspace is required.')
      const response = await fetch(`/api/measurements/property?workspaceId=${encodeURIComponent(workspaceId)}&lat=${position.coords.latitude}&lon=${position.coords.longitude}`, { cache: 'no-store' })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Could not find the address from this location.')
      const found = typeof payload.geocode?.displayName === 'string' ? payload.geocode.displayName : payload.address
      if (!found) throw new Error('No address came back for this location.')
      setAddress(found)
      setStatus(`Address found: ${found}. Loading skyview.`)
      autoLookupAttemptRef.current = ''
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not find the house from this location.')
    } finally {
      setWorking(false)
    }
  }

  async function lookupImagery() {
    const requestedAddress = address.trim()
    if (!requestedAddress) { setError('Enter a property address first.'); return }
    const requestSeq = ++lookupSeqRef.current
    autoLookupAttemptRef.current = requestedAddress
    setWorking(true)
    setError('')
    setMapCenter(null)
    setAerialTileUrl('')
    setAerialAttribution('')
    setManualMode(false)
    setAddressCandidates([])
    setSelectedBuildingIndex(null)
    setImageryNote('')
    try {
      const { data: workspaceId } = await supabase.rpc('current_workspace_id')
      if (!workspaceId) throw new Error('An active workspace is required.')
      const response = await fetch(`/api/measurements/property?workspaceId=${encodeURIComponent(workspaceId)}&address=${encodeURIComponent(requestedAddress)}`, { cache: 'no-store' })
      const payload = await response.json()
      if (requestSeq !== lookupSeqRef.current) return
      if (!response.ok) throw new Error(payload.error || 'Imagery lookup failed.')
      const validGeocode = Number.isFinite(payload.geocode?.latitude) && Number.isFinite(payload.geocode?.longitude)
      setMapCenter(validGeocode ? { latitude: payload.geocode.latitude, longitude: payload.geocode.longitude } : null)
      const candidates = Array.isArray(payload.candidates) ? payload.candidates : []
      setAddressCandidates(candidates)
      setManualArea(null)
      setSelectedBuildingIndex(loadRoofingWorkflowPreferences().selectSingleFootprint && candidates.length === 1 ? 0 : null)
      const aerial = payload.aerial
      const available = validGeocode && aerial?.status === 'available' && typeof aerial.tileUrl === 'string'
      setAerialTileUrl(available ? aerial.tileUrl : '')
      setAerialAttribution(available ? aerial.attribution || 'OpenAerialMap' : '')
      setManualMode(validGeocode)
      setImageryNote(available
        ? 'Openly licensed aerial image found. Trace the roof boundary on the imagery; verify pitch and edges before estimating.'
        : candidates.length
          ? `Address located. ${candidates.length} mapped building footprint(s) found. Street map tracing is available without uploading a photo; aerial tiles are unavailable.`
          : `Address located. Street map fallback available for reference only. AERIAL IMAGERY UNAVAILABLE: ${aerial?.reason || 'No qualifying open aerial image found.'}`)
    } catch (err) {
      if (requestSeq !== lookupSeqRef.current) return
      setMapCenter(null)
      setAerialTileUrl('')
      setAerialAttribution('')
      setManualMode(false)
      setAddressCandidates([])
      setSelectedBuildingIndex(null)
      setImageryNote('')
      setError(err instanceof Error ? err.message : 'Imagery lookup failed.')
    } finally {
      if (requestSeq === lookupSeqRef.current) setWorking(false)
    }
  }

  useEffect(() => {
    if (!canAutoLookupAddress(address, automationPrefs) || autoLookupAttemptRef.current === address.trim()) return
    const timer = window.setTimeout(() => { void lookupImagery() }, 1200)
    return () => window.clearTimeout(timer)
  // Triggered by address text and explicit owner preferences, never by a successful lookup state change.
  }, [address, automationPrefs.autoAddressLookup])

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
    setStatus('Saving the roof photo privately, then connecting to Ollama on this device…')
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
      setStatus('Sending the selected image from this browser to local Ollama at localhost:11434…')
      const aiPayload = await analyzeRoofImageWithLocalOllama(file, imageSize.width, imageSize.height, `inspection-photo:${objectId}`)
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
      if (!response.ok) throw new Error(payload?.error || 'Validated AI geometry could not be saved.')
      setMeasurementId(payload.measurement.id)
      setSuggestion(payload.suggestion ? { ...payload.suggestion, planes: payload.suggestion.planes.map((plane: Plane) => ({ ...plane, pitchRisePer12: reviewedPlanePitch(plane.suggested_pitch) ?? undefined })) } : null)
      const formulation = payload.suggestion?.formulation
      const cachedMeasurement = payload.cached ? payload.measurement : null
      const cachedCalibrated = cachedMeasurement?.calibration_status === 'calibrated' || cachedMeasurement?.calibration_status === 'confirmed'
      const cachedConfirmed = cachedMeasurement?.status === 'confirmed'
      setCalibrated(cachedCalibrated)
      setGeometryConfirmed(cachedConfirmed)
      const savedHumanReview = cachedMeasurement?.ai_formulation?.human_geometry_review
      setOrthographicTopDown(savedHumanReview?.orthographic_top_down_confirmed === true)
      setUniformPitchConfirmed(false)
      if (savedHumanReview?.uniform_pitch_confirmed === true) setUniformPitchConfirmed(true)
      setPerPlanePitchMode(savedHumanReview?.uniform_pitch_confirmed === false)
      if (formulation) {
        setScalePixels(formulation.scale_reference_pixels == null ? '' : String(formulation.scale_reference_pixels))
        setScaleFeet(formulation.scale_reference_feet == null ? '' : String(formulation.scale_reference_feet))
        setPitchRisePer12(formulation.pitch_rise_per_12 == null ? '' : String(formulation.pitch_rise_per_12))
      }
      if (cachedMeasurement) {
        setScalePixels(cachedMeasurement.scale_reference_pixels == null ? '' : String(cachedMeasurement.scale_reference_pixels))
        setScaleFeet(cachedMeasurement.scale_reference_feet == null ? '' : String(cachedMeasurement.scale_reference_feet))
      }
      if (savedHumanReview?.uniform_pitch_confirmed === true && typeof savedHumanReview.uniform_pitch_rise_per_12 === 'number') {
        setPitchRisePer12(String(savedHumanReview.uniform_pitch_rise_per_12))
      }
      setSavedMeasurementId('')
      setStatus(payload.cached
        ? cachedConfirmed ? 'Confirmed AI geometry loaded from the workspace.' : cachedCalibrated ? 'Calibrated AI geometry loaded. Confirm geometry or continue review.' : 'Existing AI suggestions loaded. Review and calibration state preserved.'
        : `Local Ollama (${aiPayload.model}) formulated the roof measurement packet. Review geometry and calibrate the image before deriving quantities.`)
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

  async function setPlanePitchRisePer12(plane: Plane) {
    if (geometryConfirmed || working || !plane.dbId) return
    const raw = window.prompt('Measured roof pitch rise per 12 inches (0–36). Enter the number only.', plane.pitchRisePer12 == null ? '' : String(plane.pitchRisePer12))
    if (raw === null) return
    const rise = parsePitchRise(raw)
    if (rise === null) { setError('Enter a measured numeric pitch between 0/12 and 36/12.'); return }
    await review('plane', plane, 'edit', { pitch: String(rise), pitchRisePer12: rise, suggested_pitch: `reviewed:${rise}/12` })
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
    if (!measurementId || !calibrated || !orthographicTopDown || (!uniformPitchConfirmed && !perPlanePitchMode)) {
      setError('Confirm top-down imagery and measured uniform or per-plane pitch first.')
      return
    }
    setWorking(true)
    setError('')
    try {
      const response = await fetch('/api/measurements/aerial', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'confirm', aerialMeasurementId: measurementId, orthographicTopDownConfirmed: orthographicTopDown, uniformPitchConfirmed, pitchRisePer12: uniformPitchConfirmed ? pitchValue : undefined }),
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
    if (!suggestion || !calibrated || !geometryConfirmed || !orthographicTopDown || (!uniformPitchConfirmed && !perPlanePitchMode) || (uniformPitchConfirmed && pitchRisePer12.trim() === '')) return null
    try {
      return calculateCalibratedRoofDraft({
        planes: suggestion.planes.map(plane => ({ ...plane, pitchRisePer12: plane.pitchRisePer12 ?? reviewedPlanePitch(plane.suggested_pitch) ?? undefined })),
        scaleReferencePixels: Number(scalePixels),
        scaleReferenceFeet: Number(scaleFeet),
        pitchRisePer12: uniformPitchConfirmed ? pitchValue : 0,
        orthographicTopDownConfirmed: orthographicTopDown,
        uniformPitchConfirmed,
        geometryConfirmed,
      })
    } catch {
      return null
    }
  }, [suggestion, calibrated, geometryConfirmed, orthographicTopDown, uniformPitchConfirmed, perPlanePitchMode, pitchRisePer12, pitchValue, scalePixels, scaleFeet])

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
        'AI-FORMULATED MEASUREMENT. Derived from the model packet, source image, geometry, scale, and pitch formulation.',
        `AI scale formulation: ${scalePixels} image pixels = ${scaleFeet} feet (${draftQuantity.pixelsPerFoot} px/ft).`,
        uniformPitchConfirmed ? `Human-confirmed uniform pitch: ${pitchRisePer12}/12; slope multiplier ${draftQuantity.slopeMultiplier}.` : `Human-reviewed mixed pitch by plane: ${suggestion?.planes.filter(p => p.review_status !== 'rejected').map(p => `${p.id}=${p.pitchRisePer12 ?? reviewedPlanePitch(p.suggested_pitch)}/12`).join(', ')}; effective slope multiplier ${draftQuantity.slopeMultiplier}.`,
        `Derived plan area ${draftQuantity.planAreaSqFt} sq ft; slope-adjusted roof area ${draftQuantity.roofAreaSqFt} sq ft; ${draftQuantity.roofSquares} squares.`,
        'Formula: sum of accepted-plane shoelace pixel areas multiplied by each plane slope factor sqrt(1 + (rise/12)^2), divided by pixels-per-foot squared.',
      ].join(' ')
      const response = await fetch('/api/measurements/manual', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          inspectionId,
          roofAreaSqft: draftQuantity.roofAreaSqFt,
          roofSquares: purchasableRoofing(draftQuantity.roofAreaSqFt, allowSixSquareRepairThreshold)?.squares ?? draftQuantity.roofSquares,
          allowSixSquareRepairThreshold,
          pitch: uniformPitchConfirmed ? `${pitchRisePer12}/12` : 'mixed',
          sourceReference: `aerial-geometry:${measurementId}`,
          sourceType: 'ai_formulated',
          provisionalGeometryDraft: true,
          confidence: suggestion?.formulation?.confidence ?? 'medium',
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
          <p className="mt-1 max-w-3xl text-sm text-slate-400"><b className="text-white">AI formulates. ROOF/OS validates and records provenance.</b> Geometry, scale, pitch, and quantities are produced as one measurement packet.</p>
        </header>

        <RoofingWizardNavigator active="/measure" />
        <RoofingWorkflowSettings compact />
        <section className="glass rounded-xl p-4">
          <div className="grid gap-3 md:grid-cols-[1fr_auto]">
            <label className="text-sm font-medium text-slate-200">Property address
              <input value={address} onChange={(event) => { lookupSeqRef.current++; setWorking(false); setAddress(event.target.value); setMapCenter(null); setAerialTileUrl(''); setAddressCandidates([]); setSelectedBuildingIndex(null); setManualArea(null); setImageryNote(''); }} className="mt-1 w-full rounded-lg border border-white/15 bg-black/25 p-3 text-white placeholder:text-slate-500" placeholder="Enter property address" />
            </label>
            <div className="flex items-end gap-2">
              <label className="flex items-center gap-2 text-xs text-slate-300">
                <input type="checkbox" checked={allowSixSquareRepairThreshold} onChange={(event) => setSixSquareSetting(event.target.checked)} />
                Owner setting: treat under 6sq as repair. Off by default. Full replacement still starts at 10sq.
              </label>
              <button onClick={() => void lookupImagery()} disabled={working} className="rounded-lg border border-white/20 px-3 py-2 text-sm text-slate-200 hover:border-cyan-400/60 disabled:opacity-50">Lookup address & aerial map</button>
              <button onClick={() => void findHouseFromHere()} disabled={working} className="rounded-lg bg-cyan-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Find address from this photo location</button>
              <button onClick={() => void router.push('/photo-estimate')} className="rounded-lg border border-white/20 px-3 py-2 text-sm text-cyan-300">Inspection photos</button>
            </div>
          </div>
          {imageryNote && <p className="mt-3 rounded-lg border border-cyan-400/20 bg-cyan-400/10 p-3 text-xs text-cyan-200">{imageryNote}</p>}
          {address.trim().length > 0 && <div className="mt-3 flex flex-wrap gap-2">
            <a href={'/supplement?address=' + encodeURIComponent(address.trim())} className="rounded border border-white/20 px-3 py-2 text-xs text-cyan-200">Continue this address in supplement wizard</a>
            <a href="/sketch" className="rounded border border-white/20 px-3 py-2 text-xs text-cyan-200">Open manual roof sketch</a>
            <a href={'/estimate/new?address=' + encodeURIComponent(address.trim())} className="rounded border border-white/20 px-3 py-2 text-xs text-cyan-200">Start estimate with this address</a>
          </div>}
          {addressCandidates.length > 0 && <section className="mt-3 space-y-2" aria-label="Mapped building footprints">
            <h2 className="text-sm font-semibold text-white">Buildings near this address — no photo required</h2>
            {addressCandidates.map((candidate, index) => <div key={`${candidate.osmId ?? 'building'}-${index}`} className="rounded-lg border border-white/15 bg-black/20 p-3 text-sm">
              <label className="flex items-center gap-2 font-medium"><input type="radio" name="building-candidate" checked={selectedBuildingIndex === index} onChange={() => setSelectedBuildingIndex(index)} /> Building {index + 1} · {candidate.buildingType}</label>
              <p className="text-cyan-200">Mapped ground footprint: {candidate.footprintSqFt.toLocaleString()} sq ft · perimeter: {candidate.perimeterFt.toLocaleString()} ft</p>
              <p className="text-xs text-amber-200">OpenStreetMap, low confidence. Not roof surface area or an estimate-ready quantity. Verify the building, roof outline, overhangs, and pitch before estimating.</p>
            </div>)}
          </section>}
          {address.trim() && <p className="mt-3 text-sm text-slate-200">Skyview is loaded from this address. When the measurement is ready, send it to the estimate wizard.
            <a className="ml-2 text-cyan-300 underline" href={`/estimate/new?address=${encodeURIComponent(address.trim())}${draftQuantity ? `&squares=${encodeURIComponent(String(draftQuantity.roofSquares))}` : ''}`}>Open estimate wizard</a>
          </p>}
          {selectedBuildingIndex !== null && addressCandidates[selectedBuildingIndex] && <div className="mt-3 rounded-lg border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-100" role="status">
            <p className="font-semibold">Automatic map measurement candidate — not estimate-ready</p>
            <p>Mapped horizontal building footprint: {addressCandidates[selectedBuildingIndex].footprintSqFt.toLocaleString()} sq ft. Approximate ground perimeter: {addressCandidates[selectedBuildingIndex].perimeterFt.toLocaleString()} ft.</p>
            {Number.isFinite(pitchValue) && pitchValue >= 0 && pitchValue <= 36 && <p>Illustrative slope-adjusted area at {pitchValue}/12: {previewRoofAreaFromFootprint(addressCandidates[selectedBuildingIndex].footprintSqFt, pitchValue)?.illustrativeSlopedSqFt.toLocaleString(undefined, { maximumFractionDigits: 0 }) ?? 'Unavailable'} sq ft, ASSUMING uniform pitch, no overhang and no other roof planes. This is not a verified roof measurement.</p>}
            <p className="mt-1 text-xs">Select the correct building, confirm a measured roof pitch, and trace each roof plane before saving a quantity. No photo is required to inspect this candidate. Do not order material from this projection.</p>
            <p className="mt-2 text-xs">Automatic footprint is sourced from map geometry, not independently measured roof edges. Use the manual multi-plane tracer below to compare its result.</p>
          </div>}

          <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={chooseFile} />
          <div className="mt-4 flex flex-wrap gap-2">
            <button onClick={() => inputRef.current?.click()} className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold text-white">{file ? 'Replace actual image' : 'Load actual aerial / inspection image'}</button>
            <button onClick={() => setManualMode(!manualMode)} className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold text-white">{manualMode ? 'Exit Manual Mode' : 'Manual Measurement'}</button>
          </div>
          {manualMode && <ManualDrawingTool
            key={preview || (mapCenter ? String(mapCenter.latitude) + ':' + String(mapCenter.longitude) + ':' + (aerialTileUrl || 'street-map') : 'no-map')}
            imageUrl={preview}
            mapCenter={mapCenter}
            aerialTileUrl={aerialTileUrl}
            aerialAttribution={aerialAttribution}
            imageWidth={imageSize.width || 500}
            imageHeight={imageSize.height || 500}
            scalePixels={Number(scalePixels) || 0}
            scaleFeet={Number(scaleFeet) || 0}
            allowSixSquareRepairThreshold={allowSixSquareRepairThreshold}
            onAreaCalculated={(result) => setManualArea(result.value > 0 ? result : null)}
          />}
          {manualArea && (() => {
            const planSqFt = manualArea.unit === 'sqft' ? manualArea.value : manualArea.squareFeet
            const candidate = selectedBuildingIndex !== null ? addressCandidates[selectedBuildingIndex] : null
            const comparison = candidate && planSqFt && planSqFt > 0
              ? Math.abs(candidate.footprintSqFt - planSqFt) / Math.max(candidate.footprintSqFt, planSqFt) * 100 : null
            const projection = planSqFt && pitchRisePer12.trim() && Number.isFinite(pitchValue)
              ? previewRoofAreaFromFootprint(planSqFt, pitchValue) : null
            return <section aria-label="Automatic and manual measurement comparison" className="mt-3 rounded-lg border border-amber-400/25 bg-amber-400/10 p-3 text-sm text-amber-100">
              <h3 className="font-semibold">Manual vs. automatic measurement check</h3>
              <p className="mt-1">{planSqFt != null
                ? `Manual trace: ${planSqFt.toFixed(1)} sq ft horizontal plan area.`
                : `Unscaled manual trace: ${Math.round(manualArea.value).toLocaleString()} px². Enter a known pixel-to-feet reference before comparing dimensions.`}</p>
              {candidate && <p>Map candidate: {candidate.footprintSqFt.toFixed(1)} sq ft mapped ground footprint.</p>}
              {comparison !== null && <p className={comparison > 15 ? 'font-semibold text-red-200' : 'text-amber-100'}>
                Difference: {comparison.toFixed(1)}% of the larger area. {comparison > 15 ? 'Discrepancy requires manual review: wrong building, roof overhangs or incomplete planes may explain it.' : 'The measurements are closer, but neither is independently verified.'}
              </p>}
              {projection && <p>Illustrative sloped area ({pitchValue}/12 uniform pitch): {projection.illustrativeSlopedSqFt.toFixed(1)} sq ft. No overhang, valleys, dormer complexity or varying pitches included.</p>}
              <p className="mt-2 text-xs">No material order or insurance submission is authorized. Review imagery, field dimensions and plane boundaries first.</p>
            </section>
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
          {file && <p className="mt-2 text-xs text-slate-400">{file.name} · {imageSize.width}×{imageSize.height}px · saved privately before local Ollama analysis. Requires Ollama model qwen3-vl:8b and this site's origin allowed in OLLAMA_ORIGINS.</p>}
          {error && <p className="mt-3 rounded-lg border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-300" role="alert">{error}</p>}
          {status && <p className="mt-3 rounded-lg border border-emerald-400/30 bg-emerald-400/10 p-3 text-sm text-emerald-300" role="status">{status}</p>}
        </section>

        <section className="glass mt-4 rounded-xl border border-cyan-400/25 p-4" aria-label="Automatic measurement readiness checks">
          <h2 className="text-sm font-semibold">Measurement readiness — live checks</h2>
          <div className="mt-2 grid gap-1 text-xs sm:grid-cols-2">
            {([
              ['Address entered', address.trim().length >= 8],
              ['Map located', Boolean(mapCenter)],
              ['Building footprint selected', selectedBuildingIndex !== null],
              ['Roof pitch entered and plausible', pitchRisePer12.trim() !== '' && Number.isFinite(pitchValue) && pitchValue >= 0 && pitchValue <= 36],
              ['Manual trace recorded', Boolean(manualArea)],
              ['AI geometry reviewed and calibrated', Boolean(calibrated && geometryConfirmed)],
            ] as const).map(([label, done]) => <p key={label} className={done ? 'text-emerald-200' : 'text-amber-200'}>{done ? '✓' : '○'} {label}</p>)}
          </div>
          <p className="mt-2 text-xs text-slate-400">Readiness checks do not certify a measurement. A map footprint is only a ground reference; authoritative roof quantities still require independent review.</p>
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
          {suggestion && <p className="mt-2 text-xs text-slate-400">Dashed cyan polygons = AI suggestions · amber lines = suggested edges · red dots = suggested objects. These are not quantities.</p>}
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
                  <button disabled={working || geometryConfirmed} onClick={() => void setPlanePitchRisePer12(plane)} className="rounded border border-white/20 px-2 py-1 text-xs disabled:opacity-50">Set measured pitch</button>
                </span>
              </div>
              {plane.review_status !== 'rejected' && <p className="mt-1 text-xs text-slate-300">Reviewed plane pitch: {plane.pitchRisePer12 == null && reviewedPlanePitch(plane.suggested_pitch) == null ? 'not measured' : `${plane.pitchRisePer12 ?? reviewedPlanePitch(plane.suggested_pitch)}/12`}</p>}
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
            <p className="mt-1 text-xs text-slate-400">AI scale and pitch formulation is used when available; these fields remain editable for a later correction workflow.</p>
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
          <p className="mt-1 text-xs text-slate-400">Calculated from the AI-formulated geometry, scale, pitch, and quantity packet.</p>
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
            <input type="checkbox" checked={uniformPitchConfirmed} onChange={(event) => { setUniformPitchConfirmed(event.target.checked); if (event.target.checked) setPerPlanePitchMode(false) }} className="mt-1" />
            <span>I measured this pitch and confirm it applies to every accepted roof plane.</span>
          </label>
          <label className="mt-3 flex items-start gap-2 text-sm text-slate-200">
            <input type="checkbox" checked={perPlanePitchMode} onChange={(event) => { setPerPlanePitchMode(event.target.checked); if (event.target.checked) setUniformPitchConfirmed(false) }} className="mt-1" />
            <span>Use separately measured pitches for each accepted plane (saved in the review queue before confirmation).</span>
          </label>
          {perPlanePitchMode && !uniformPitchConfirmed && suggestion?.planes.some(plane => plane.review_status !== 'rejected' && (plane.pitchRisePer12 ?? reviewedPlanePitch(plane.suggested_pitch)) == null) && <p className="mt-2 text-xs text-amber-300">Each accepted plane needs a reviewed pitch before a mixed-pitch draft can be calculated.</p>}
          {draftQuantity ? <div className="mt-4 rounded-lg border border-cyan-400/25 bg-cyan-400/10 p-3">
            <p className="font-semibold text-cyan-100">Draft only · not estimate-authoritative</p>
            <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
              <div><dt className="text-slate-400">Accepted planes</dt><dd>{draftQuantity.acceptedPlaneCount}</dd></div>
              <div><dt className="text-slate-400">Calibrated plan area</dt><dd>{draftQuantity.planAreaSqFt.toLocaleString()} sq ft</dd></div>
              <div><dt className="text-slate-400">Slope-adjusted roof area</dt><dd>{draftQuantity.roofAreaSqFt.toLocaleString()} sq ft</dd></div>
              <div><dt className="text-slate-400">Order squares</dt><dd>{purchasableRoofing(draftQuantity.roofAreaSqFt, allowSixSquareRepairThreshold)?.squaresLabel ?? draftQuantity.roofSquares}</dd></div>
              <div><dt className="text-slate-400">Standard bundles</dt><dd>{purchasableRoofing(draftQuantity.roofAreaSqFt, allowSixSquareRepairThreshold)?.bundles ?? Math.ceil(draftQuantity.roofSquares * 3)} whole bundles</dd></div>
              <div><dt className="text-slate-400">Job class</dt><dd>{purchasableRoofing(draftQuantity.roofAreaSqFt, allowSixSquareRepairThreshold)?.jobLabel ?? 'Full replacement starts at 10 squares.'}</dd></div>
              <div><dt className="text-slate-400">Measured pitch</dt><dd>{uniformPitchConfirmed ? `${draftQuantity.pitchRisePer12}/12` : 'Mixed — per plane'}</dd></div>
              <div><dt className="text-slate-400">Slope multiplier</dt><dd>{draftQuantity.slopeMultiplier}</dd></div>
            </dl>
            <p className="mt-2 text-xs text-amber-200">Plan area is computed from reviewed polygon coordinates and one scale. Slope area uses the confirmed uniform pitch or each saved, reviewed plane pitch. Verify edges, dormers, overhangs, valleys and actual site pitch independently.</p>
            <button onClick={() => void saveDraftQuantity()} disabled={working || Boolean(savedMeasurementId)} className="mt-3 rounded-lg bg-cyan-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{savedMeasurementId ? 'Saved as unverified draft' : 'Save as unverified draft measurement'}</button>
            {savedMeasurementId && <p className="mt-2 text-xs text-emerald-200">Measurement record: {savedMeasurementId}</p>}
          </div> : <p className="mt-3 rounded-lg border border-white/10 bg-black/20 p-3 text-sm text-slate-400">No quantity yet. Confirm geometry, calibration, top-down image type, measured pitch, and uniform pitch across accepted planes; accept or edit at least one plane.</p>}
        </section>}

        {!suggestion && <section className="glass mt-4 rounded-xl border-dashed p-4 text-sm text-slate-400">Manual measurement remains available even when AI analysis is unavailable. No fabricated image, geometry, scale, or measurement is shown.</section>}
      </div>
    </main>
  )
}
