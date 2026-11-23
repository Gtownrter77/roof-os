'use client'

import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import AutoMeasurementTool from './AutoMeasurementTool'
import { createClient } from '../lib/supabase/client'

const ManualDrawingTool = dynamic(() => import('./ManualDrawingTool'), { ssr: false })

type PixelPlane = Array<{ x: number; y: number }>
type MashupMode = 'auto' | 'manual'
type PreviewArea = { value: number; unit: 'px' | 'sqft'; squareFeet: number | null }
type Provenance = {
  gpsVerified: boolean
  autoMeasurementsAllowed: boolean
  status: string
  reason: string | null
  embeddedAddress: string | null
}

type Props = { photoId: string; inspectionId: string }

/**
 * One certified photo, two DISTINCT uses. Auto delegates to the unchanged
 * existing measurement workspace; Manual persists hand-traced vertices and
 * drives the reviewed-trace pipeline. No address-first intake and no new
 * authority UI: the server always recomputes the quantity.
 */
export default function RoofrRoofsnapForm({ photoId, inspectionId }: Props) {
  const router = useRouter()
  const [supabase] = useState(() => createClient())
  const [mode, setMode] = useState<MashupMode>('manual')
  const [provenance, setProvenance] = useState<Provenance | null>(null)
  const [contextError, setContextError] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 })
  const [planes, setPlanes] = useState<PixelPlane[]>([])
  const [previewAreaSqft, setPreviewAreaSqft] = useState<PreviewArea | null>(null)
  const [scalePixels, setScalePixels] = useState('')
  const [scaleFeet, setScaleFeet] = useState('')
  const [planePitches, setPlanePitches] = useState<string[]>([])
  const [uniformPitchConfirmed, setUniformPitchConfirmed] = useState(false)
  const [pitchRisePer12, setPitchRisePer12] = useState('')
  const [topDownConfirmed, setTopDownConfirmed] = useState(false)
  const [working, setWorking] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [savedMeasurementId, setSavedMeasurementId] = useState('')

  const canMeasure = provenance?.gpsVerified === true
  const canAuto = canMeasure && provenance?.autoMeasurementsAllowed === true
  const pitchValue = pitchRisePer12.trim() === '' ? Number.NaN : Number(pitchRisePer12)

  useEffect(() => {
    let active = true
    async function loadContext() {
      setContextError('')
      // A different certified photo invalidates every prior trace, scale,
      // preview and attestation. Reset synchronously before any await so no
      // stale value can be POSTed against the new photo.
      setPlanes([])
      setPreviewAreaSqft(null)
      setScalePixels('')
      setScaleFeet('')
      setPlanePitches([])
      setUniformPitchConfirmed(false)
      setPitchRisePer12('')
      setTopDownConfirmed(false)
      setSavedMeasurementId('')
      setMessage('')
      setError('')
      if (!photoId || !inspectionId) {
        setContextError('A certified photo id and inspection id are required. Open this page from a saved inspection photo.')
        return
      }
      try {
        const { data: workspaceId, error: workspaceError } = await supabase.rpc('current_workspace_id')
        if (workspaceError || !workspaceId) { setContextError('Sign in with a workspace before measuring.'); return }
        const { data: photo, error: photoError } = await supabase
          .from('inspection_photos')
          .select('id,object_path')
          .eq('id', photoId)
          .eq('inspection_id', inspectionId)
          .eq('workspace_id', workspaceId)
          .maybeSingle()
        if (photoError || !photo) { setContextError('The selected photo is not available in this workspace.'); return }

        const verificationResponse = await fetch('/api/photo-provenance/verify', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ photoId }),
        })
        const verification = await verificationResponse.json().catch(() => null)
        if (!active) return
        setProvenance(verification && typeof verification === 'object' ? {
          gpsVerified: verification.gpsVerified === true,
          autoMeasurementsAllowed: verification.autoMeasurementsAllowed === true,
          status: typeof verification.status === 'string' ? verification.status : 'Unknown',
          reason: typeof verification.reason === 'string' ? verification.reason : null,
          embeddedAddress: typeof verification.embeddedAddress === 'string' ? verification.embeddedAddress : null,
        } : {
          gpsVerified: false, autoMeasurementsAllowed: false, status: 'Unknown',
          reason: 'Provenance verification unavailable.', embeddedAddress: null,
        })

        const signed = await supabase.storage.from('inspection-photos').createSignedUrl(photo.object_path, 300)
        if (!active) return
        if (signed.error || !signed.data?.signedUrl) { setContextError('The certified photo could not be loaded for tracing.'); return }
        const url = signed.data.signedUrl
        setImageUrl(url)
        const image = new Image()
        image.onload = () => { if (active) setImageSize({ width: image.naturalWidth, height: image.naturalHeight }) }
        image.onerror = () => { if (active) setContextError('The certified photo could not be decoded.') }
        image.src = url
      } catch (err) {
        if (active) setContextError(err instanceof Error ? err.message : 'The certified photo could not be loaded.')
      }
    }
    void loadContext()
    return () => { active = false }
  }, [photoId, inspectionId, supabase])

  useEffect(() => {
    setPlanePitches((current) => {
      const next = planes.map((_, index) => current[index] ?? '')
      return next.length === current.length && next.every((value, index) => value === current[index]) ? current : next
    })
  }, [planes])

  // Auto is the unchanged existing path: AutoMeasurementTool stays untouched,
  // and its detect callback hands off to the already-approved auto workspace.
  async function runAuto() {
    if (!canAuto) throw new Error('Automatic measurement requires verified GPS provenance and the workspace owner toggle.')
    router.push(`/measure?photoId=${encodeURIComponent(photoId)}&inspection=${encodeURIComponent(inspectionId)}`)
  }

  // Manual: vertices -> confirmed attest -> authoritative save. Task 4 already
  // persisted calibration_status='calibrated', so only the confirm call is made.
  async function saveHandTrace() {
    if (!canMeasure) { setError('Evidence only: no measurement may start without verified GPS provenance.'); return }
    setWorking(true)
    setError('')
    setMessage('')
    try {
      if (!imageSize.width || !imageSize.height) throw new Error('The certified photo dimensions are not available yet.')
      if (planes.length === 0) throw new Error('Finish at least one roof plane before saving a hand trace.')
      const scaleReferencePixels = Number(scalePixels)
      const scaleReferenceFeet = Number(scaleFeet)
      if (!Number.isFinite(scaleReferencePixels) || scaleReferencePixels <= 0
        || !Number.isFinite(scaleReferenceFeet) || scaleReferenceFeet <= 0) {
        throw new Error('Enter a positive measured pixel-to-feet scale reference.')
      }
      const parsedPitches = planes.map((_, index) => {
        const raw = (planePitches[index] ?? '').trim()
        const value = raw === '' ? Number.NaN : Number(raw)
        if (!Number.isFinite(value) || value < 0 || value > 36) {
          throw new Error(`Plane ${index + 1} needs a measured pitch between 0/12 and 36/12.`)
        }
        return value
      })
      if (!topDownConfirmed) throw new Error('Confirm the imagery is orthographic top-down before attesting.')
      if (uniformPitchConfirmed && (!Number.isFinite(pitchValue) || pitchValue < 0 || pitchValue > 36)) {
        throw new Error('Enter a measured uniform pitch between 0/12 and 36/12.')
      }

      const traceResponse = await fetch('/api/measurements/manual-trace', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          inspectionId,
          photoId,
          imageWidth: imageSize.width,
          imageHeight: imageSize.height,
          planes: planes.map((vertices, index) => ({ vertices, pitchRisePer12: parsedPitches[index] })),
          scaleReferencePixels,
          scaleReferenceFeet,
        }),
      })
      const tracePayload = await traceResponse.json().catch(() => null)
      if (!traceResponse.ok) throw new Error(tracePayload?.error || 'The hand trace could not be saved.')
      const traceId = tracePayload?.measurement?.id
      if (typeof traceId !== 'string' || !/^[0-9a-f-]{36}$/i.test(traceId)) {
        throw new Error('The hand trace did not return a valid reference.')
      }
      setSavedMeasurementId('')

      const attestResponse = await fetch('/api/measurements/aerial', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'confirm',
          aerialMeasurementId: traceId,
          orthographicTopDownConfirmed: true,
          uniformPitchConfirmed,
          pitchRisePer12: uniformPitchConfirmed ? pitchValue : undefined,
        }),
      })
      const attestPayload = await attestResponse.json().catch(() => null)
      if (!attestResponse.ok) throw new Error(attestPayload?.error || 'The top-down and pitch attestations could not be saved.')

      const saveResponse = await fetch('/api/measurements/manual', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          inspectionId,
          // Preview only: the server recomputes authority from persisted
          // vertices, scale and reviewed pitch and rejects a stale display.
          roofAreaSqft: previewAreaSqft?.squareFeet ?? null,
          pitch: uniformPitchConfirmed ? `${pitchRisePer12}/12` : 'mixed',
          sourceType: 'manual_traced',
          sourceReference: `manual-trace:${traceId}`,
          notes: 'Hand-traced roof planes from the certified inspection photo. The server recomputes the authoritative quantity from the stored vertices, scale and reviewed pitch; any displayed plan area was a provisional preview only.',
        }),
      })
      const savePayload = await saveResponse.json().catch(() => null)
      if (!saveResponse.ok) throw new Error(savePayload?.error || 'The hand-traced measurement could not be saved.')
      const savedId = savePayload?.measurement?.id
      if (typeof savedId !== 'string' || !/^[0-9a-f-]{36}$/i.test(savedId)) {
        throw new Error('The server did not return a valid saved measurement reference.')
      }
      setSavedMeasurementId(savedId)
      setMessage('Saved as a server-recomputed hand trace. It remains unverified until an independent reviewer approves the quantity.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The hand-traced measurement could not be saved.')
    } finally {
      setWorking(false)
    }
  }

  return (
    <main className="mx-auto max-w-[1240px] space-y-4 p-4 pb-16 md:p-6">
      <header className="glass rounded-xl p-4">
        <p className="ops-label">ROOF/OS · certified photo measurement</p>
        <h1 className="text-2xl font-black">Two ways to measure this photo</h1>
        <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-300">
          <span>Photo: {photoId ? photoId.slice(0, 8) : 'Unknown'}</span>
          <span>Inspection: {inspectionId ? inspectionId.slice(0, 8) : 'Unknown'}</span>
          <span>Provenance: {provenance?.gpsVerified === true ? 'Verified embedded GPS and address' : 'Unknown — evidence only'}</span>
          <span>Auto use: {canAuto ? 'Allowed by workspace owner' : 'Off or not verified'}</span>
        </div>
        <p className="mt-2 text-xs text-slate-400">
          Load a certified photo from a saved inspection before measuring. Both uses share this provenance header; neither fabricates a measurement from an unverified image.
        </p>
      </header>

      {contextError && <p role="alert" className="rounded-lg border border-red-400/30 p-3 text-sm text-red-200">{contextError}</p>}
      {provenance && !canMeasure && <p role="status" className="rounded-lg border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-100">
        Evidence only: this photo has no server-verified embedded GPS and address. No measurement starts here.
      </p>}

      <div role="tablist" aria-label="Measurement use" className="flex flex-wrap gap-2">
        <button type="button" role="tab" aria-selected={mode === 'auto'} onClick={() => setMode('auto')}
          className={`rounded-lg px-4 py-2 text-sm font-semibold ${mode === 'auto' ? 'bg-blue-700 text-white' : 'border border-white/20 text-slate-200'}`}>
          Auto use (Roofr-like)
        </button>
        <button type="button" role="tab" aria-selected={mode === 'manual'} onClick={() => setMode('manual')}
          className={`rounded-lg px-4 py-2 text-sm font-semibold ${mode === 'manual' ? 'bg-cyan-700 text-white' : 'border border-white/20 text-slate-200'}`}>
          Manual use (RoofSnap-like)
        </button>
      </div>

      {mode === 'auto' && (
        <section aria-label="Auto measurement use" className="glass rounded-xl p-4">
          <p className="text-sm text-slate-300">
            Automatic analysis runs only when this photo has verified embedded GPS provenance and the workspace owner has enabled the toggle. Otherwise it stays evidence-only.
          </p>
          <AutoMeasurementTool
            hasImage={Boolean(imageUrl && imageSize.width && imageSize.height && canAuto)}
            working={false}
            onDetect={runAuto}
            onManualFallback={() => setMode('manual')}
          />
        </section>
      )}

      {mode === 'manual' && (
        <section aria-label="Manual hand-trace use" className="glass space-y-3 rounded-xl p-4">
          <ManualDrawingTool
            imageUrl={imageUrl}
            imageWidth={imageSize.width || 500}
            imageHeight={imageSize.height || 500}
            scalePixels={Number(scalePixels) || 0}
            scaleFeet={Number(scaleFeet) || 0}
            onPlanesChange={setPlanes}
            onAreaCalculated={(result) => setPreviewAreaSqft(result.value > 0 ? result : null)}
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-slate-300">Scale reference — image pixels
              <input type="number" min="1" value={scalePixels} onChange={(event) => setScalePixels(event.target.value)}
                className="mt-1 w-full rounded-lg border border-white/15 bg-black/25 p-2" />
            </label>
            <label className="text-xs text-slate-300">Scale reference — measured feet
              <input type="number" min="0.1" step="0.1" value={scaleFeet} onChange={(event) => setScaleFeet(event.target.value)}
                className="mt-1 w-full rounded-lg border border-white/15 bg-black/25 p-2" />
            </label>
          </div>

          {planes.length > 0 && <div className="space-y-2 rounded-lg border border-white/15 p-3">
            <h3 className="text-sm font-semibold">Measured pitch per finished plane</h3>
            {planes.map((_, index) => <label key={index} className="block text-xs text-slate-300">
              Plane {index + 1} pitch rise per 12
              <input type="number" min="0" max="36" step="0.1" value={planePitches[index] ?? ''}
                onChange={(event) => setPlanePitches((current) => current.map((value, i) => i === index ? event.target.value : value))}
                className="mt-1 w-32 rounded-lg border border-white/15 bg-black/25 p-2" />
            </label>)}
            <label className="flex items-center gap-2 text-xs text-slate-300">
              <input type="checkbox" checked={uniformPitchConfirmed} onChange={(event) => setUniformPitchConfirmed(event.target.checked)} />
              One measured uniform pitch for the whole roof
            </label>
            {uniformPitchConfirmed && <label className="block text-xs text-slate-300">Uniform pitch rise per 12
              <input type="number" min="0" max="36" step="0.1" value={pitchRisePer12} onChange={(event) => setPitchRisePer12(event.target.value)}
                className="mt-1 w-32 rounded-lg border border-white/15 bg-black/25 p-2" />
            </label>}
          </div>}

          <label className="flex items-center gap-2 text-xs text-amber-100">
            <input type="checkbox" checked={topDownConfirmed} onChange={(event) => setTopDownConfirmed(event.target.checked)} />
            I confirm this image is orthographic and top-down, with no perspective or fisheye distortion.
          </label>

          {previewAreaSqft && <p className="text-xs text-amber-200">
            Provisional plan area: {previewAreaSqft.squareFeet != null
              ? `${previewAreaSqft.squareFeet.toFixed(1)} sq ft`
              : `${Math.round(previewAreaSqft.value).toLocaleString()} px² (unscaled)`}.
            Not an approved quantity; the server recomputes it from the stored geometry.
          </p>}

          <button type="button" onClick={() => void saveHandTrace()}
            disabled={working || !canMeasure || planes.length === 0 || !topDownConfirmed}
            className="rounded-lg bg-cyan-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {working ? 'Saving hand trace…' : 'Save reviewed hand trace'}
          </button>
        </section>
      )}

      {message && <p role="status" className="rounded-lg border border-emerald-400/25 p-3 text-sm text-emerald-200">{message}</p>}
      {error && <p role="alert" className="rounded-lg border border-red-400/30 p-3 text-sm text-red-200">{error}</p>}
      {savedMeasurementId && <p className="text-xs text-slate-400">Saved measurement reference: {savedMeasurementId}</p>}
    </main>
  )
}
