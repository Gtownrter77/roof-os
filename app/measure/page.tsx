'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { smartBack } from '../../lib/smart-back'
import { createClient } from '../../lib/supabase/client'
import type { GeometrySuggestion } from '../../lib/ai/geometry-contract'
import { analyzeRoofImageWithLocalOllama } from '../../lib/ai/local-vision-browser'
import { readEmbeddedGps } from '../../lib/photo-provenance.mjs'
import { calculateCalibratedRoofDraft } from '../../lib/measurements/calibrated-roof-draft'
import { previewRoofAreaFromFootprint } from '../../lib/measurements/footprint-preview'
import { purchasableRoofing, roofAreaRangeError } from '../../lib/measurements/purchasable-roofing'
import RoofSlopeCard from '../../components/RoofSlopeCard'
import AutoMeasurementTool from '../../components/AutoMeasurementTool'
import RoofingWorkflowSettings from '../../components/RoofingWorkflowSettings'
import RoofingWizardNavigator from '../../components/RoofingWizardNavigator'
import { readEmbeddedLocation, stampLocation, UNABLE_TO_UPLOAD } from '../../lib/photos/location'
import { canAutoLookupAddress, loadRoofingWorkflowPreferences, type RoofingWorkflowPreferences, DEFAULT_ROOFING_WORKFLOW_PREFS } from '../../lib/roofing-workflow-preferences'

const ManualDrawingTool = dynamic(() => import('../../components/ManualDrawingTool'), { ssr: false })

type Point = { x: number; y: number }
type Plane = { id: string; vertices: Point[]; suggested_pitch: string | null; reviewed_pitch_rise_per_12?: number | null; confidence: string; dbId?: string; review_status?: string; pitchRisePer12?: number }
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
  const selectedPhotoSeqRef = useRef(0)
  const [photoGps, setPhotoGps] = useState<{ latitude: number; longitude: number; embeddedAddress: string | null } | null>(null)
  const [photoGpsChecked, setPhotoGpsChecked] = useState(false)
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
  const [planePitchDrafts, setPlanePitchDrafts] = useState<Record<string, string>>({})
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

  async function chooseFile(event: React.ChangeEvent<HTMLInputElement>) {
    const next = event.target.files?.[0] ?? null
    event.target.value = ''
    if (!next || next.type !== 'image/jpeg') {
      setError('Choose a JPEG inspection image.')
      return
    }
    if (preview) URL.revokeObjectURL(preview)
    setFile(next)
    const gpsSeq = ++selectedPhotoSeqRef.current
    setPhotoGps(null)
    setPhotoGpsChecked(false)
    void next.arrayBuffer().then((bytes) => {
      const embedded = readEmbeddedGps(new Uint8Array(bytes))
      if (gpsSeq !== selectedPhotoSeqRef.current) return
      setPhotoGps(embedded ? {
        latitude: embedded.latitude, longitude: embedded.longitude,
        embeddedAddress: embedded.address || null,
      } : null)
    }).catch(() => { if (gpsSeq === selectedPhotoSeqRef.current) setPhotoGps(null) })
      .finally(() => { if (gpsSeq === selectedPhotoSeqRef.current) setPhotoGpsChecked(true) })
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
    setStatus('Photo accepted. Automation starts only if location is embedded in the file.')
    const image = new Image()
    image.onload = () => setImageSize({ width: image.naturalWidth, height: image.naturalHeight })
    image.onerror = () => setError('The selected image could not be decoded.')
    image.src = imageUrl
  }

  async function findHouseFromEmbeddedPhoto() {
    if (!file || !photoGps) {
      setError('No GPS coordinates embedded in the selected photo. Enter the property address for manual map search.')
      return
    }
    // Deliberate technician action: GPS helps find candidate imagery, but it
    // does not approve an automatic roof measurement or select a building.
    const requestSeq = ++lookupSeqRef.current
    setWorking(true)
    setError('')
    setMapCenter(null)
    setAerialTileUrl('')
    setAerialAttribution('')
    setAddressCandidates([])
    setSelectedBuildingIndex(null)
    setManualArea(null)
    setStatus('Looking up the candidate property from GPS embedded in this photo…')
    try {
      const { data: workspaceId } = await supabase.rpc('current_workspace_id')
      if (!workspaceId) throw new Error('An active workspace is required.')
      const query = new URLSearchParams({
        workspaceId, lat: photoGps.latitude.toFixed(8), lon: photoGps.longitude.toFixed(8),
      })
      const response = await fetch('/api/measurements/property?' + query.toString(), { cache: 'no-store' })
      const payload = await response.json()
      if (requestSeq !== lookupSeqRef.current) return
      if (!response.ok) throw new Error(payload.error || 'The photo address could not be located.')
      const candidateAddress = typeof payload.geocode?.displayName === 'string' ? payload.geocode.displayName.trim() : ''
      if (!candidateAddress) throw new Error('GPS did not resolve to a candidate property address.')
      // Suppress duplicate address search; this response already carries the map.
      autoLookupAttemptRef.current = candidateAddress
      setAddress(candidateAddress)
      const coordsValid = Number.isFinite(payload.geocode?.latitude) && Number.isFinite(payload.geocode?.longitude)
      setMapCenter(coordsValid ? { latitude: payload.geocode.latitude, longitude: payload.geocode.longitude } : null)
      const candidates = Array.isArray(payload.candidates) ? payload.candidates : []
      setAddressCandidates(candidates)
      setManualMode(coordsValid)
      setSelectedBuildingIndex(null) // Never auto-select an adjacent roof.
      const aerial = payload.aerial
      const available = coordsValid && aerial?.status === 'available' && typeof aerial.tileUrl === 'string'
      setAerialTileUrl(available ? aerial.tileUrl : '')
      setAerialAttribution(available ? aerial.attribution || 'OpenAerialMap' : '')
      setImageryNote(
        'CANDIDATE PROPERTY ONLY: confirm the address and correct building before measurements. ' +
        (available ? 'Open aerial imagery found; trace and verify each roof plane.' : 'Aerial imagery unavailable. Street-map/manual tracing remains available.')
      )
      setStatus('Photo EXIF GPS located a candidate address. Technician must confirm the actual building; no roof measurement was authorized.')
    } catch (err) {
      if (requestSeq !== lookupSeqRef.current) return
      setError(err instanceof Error ? err.message : 'Photo location lookup unavailable.')
      setStatus('Manual address search remains available.')
    } finally {
      if (requestSeq === lookupSeqRef.current) setWorking(false)
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

  // Auto-start Skyview lookup the moment a photo with embedded GPS is accepted.
  // Tech still confirms the building. No auto-measure, no auto-select.
  useEffect(() => {
    if (!file || !photoGps || !photoGpsChecked || working) return
    if (autoLookupAttemptRef.current) return // already attempted for this photo
    void findHouseFromEmbeddedPhoto()
  }, [file, photoGps, photoGpsChecked])

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

      const photoBytes = new Uint8Array(await file.arrayBuffer())
      if (!readEmbeddedLocation(photoBytes)) setStatus('No embedded location. This photo is manual-only and cannot trigger photo automations.')
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
      const gpsResponse = await fetch('/api/photo-provenance/verify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ photoId: objectId }) })
      const gpsStatus = await gpsResponse.json().catch(() => null)
      if (!gpsResponse.ok || gpsStatus?.gpsVerified !== true) throw new Error('Photo accepted for manual measurement only. Automatic analysis unavailable without verified embedded GPS and property address.')
      if (gpsStatus.autoMeasurementsAllowed !== true) throw new Error('Photo saved for manual measurement. Automatic measurements are OFF until the workspace owner enables them.')

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
      const cachedCalibrated = cachedMeasurement?.calibrated === true
      setCalibrated(cachedCalibrated)
      setGeometryConfirmed(cachedCalibrated && cachedMeasurement?.geometry_confirmed === true)
      setStatus(payload.cached ? 'Using previously validated geometry for this photo.' : 'Local Ollama geometry saved. Review every plane, edge, and object before calibration.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Photo analysis failed.')
      setStatus('')
    } finally {
      setWorking(false)
    }
  }

  // ... remaining original code continues unchanged below this point
