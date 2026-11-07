'use client'
import { useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { smartBack } from '../../lib/smart-back'
import { createClient } from '../../lib/supabase/client'
import RoofSlopeCard from '../../components/RoofSlopeCard'

const ManualDrawingTool = dynamic(() => import('../../components/ManualDrawingTool'), { ssr: false })

type SolarFacet = {
  index: number
  pitchString: string
  pitchDeg: number
  azimuthDeg: number
  areaSqFt: number
  squares: number
}

type SolarResult = {
  measurement: { id: string } | null
  address: string
  totalSlopedAreaSqFt: number
  roofSquares: number
  predominantPitch: string
  estimatedPerimeterFt: number
  segmentCount: number
  facets: SolarFacet[]
  warning: string
  saveError?: string
}

type ManualSaveState = 'idle' | 'saving' | 'saved' | 'error'

export default function MeasurePage() {
  const router = useRouter()
  const supabase = createClient()
  const inputRef = useRef<HTMLInputElement>(null)

  const [address, setAddress] = useState('')
  const [working, setWorking] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')

  // Solar / auto measurement
  const [solarResult, setSolarResult] = useState<SolarResult | null>(null)

  // Manual drawing tool
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState('')
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 })
  const [scalePixels, setScalePixels] = useState('')
  const [scaleFeet, setScaleFeet] = useState('')
  const [manualMode, setManualMode] = useState(false)
  const [manualAreaPx, setManualAreaPx] = useState(0)
  const [manualSaveState, setManualSaveState] = useState<ManualSaveState>('idle')
  const [manualNotes, setManualNotes] = useState('')

  const pixelsPerFoot = Number(scalePixels) > 0 && Number(scaleFeet) > 0
    ? Number(scalePixels) / Number(scaleFeet)
    : 0
  const manualAreaSqFt = manualAreaPx > 0 && pixelsPerFoot > 0
    ? manualAreaPx / (pixelsPerFoot * pixelsPerFoot)
    : 0

  function chooseFile(event: React.ChangeEvent<HTMLInputElement>) {
    const next = event.target.files?.[0] ?? null
    event.target.value = ''
    if (!next || !['image/jpeg', 'image/png', 'image/webp'].includes(next.type)) {
      setError('Choose a JPEG, PNG, or WebP inspection image.')
      return
    }
    setFile(next)
    setPreview(URL.createObjectURL(next))
    setManualAreaPx(0)
    setManualSaveState('idle')
    setError('')
    const image = new Image()
    image.onload = () => setImageSize({ width: image.naturalWidth, height: image.naturalHeight })
    image.src = URL.createObjectURL(next)
  }

  // ── Auto measurement via Google Solar API ─────────────────────────────────
  async function runSolarMeasurement() {
    const trimmed = address.trim()
    if (!trimmed) { setError('Enter a property address first.'); return }
    setWorking(true)
    setError('')
    setSolarResult(null)
    setStatus('Looking up address…')
    try {
      const { data: workspaceId } = await supabase.rpc('current_workspace_id')
      if (!workspaceId) throw new Error('No active workspace. Sign in first.')
      const url = new URL('/api/measurements/solar', window.location.origin)
      url.searchParams.set('workspaceId', workspaceId as string)
      url.searchParams.set('address', trimmed)
      setStatus('Querying Google Solar API for roof segments…')
      const res = await fetch(url.toString(), { cache: 'no-store' })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload.error ?? 'Solar measurement failed.')
      setSolarResult(payload as SolarResult)
      setStatus('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Solar measurement failed.')
      setStatus('')
    } finally {
      setWorking(false)
    }
  }

  // ── Manual measurement save ───────────────────────────────────────────────
  async function saveManualMeasurement() {
    if (manualAreaSqFt <= 0) {
      setError('Draw a roof outline and enter a scale reference (pixels and feet) before saving.')
      return
    }
    setManualSaveState('saving')
    setError('')
    try {
      const { data: workspaceId } = await supabase.rpc('current_workspace_id')
      if (!workspaceId) throw new Error('No active workspace.')
      const roofSquares = Math.round((manualAreaSqFt / 100) * 100) / 100
      const res = await fetch('/api/measurements/manual', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          roofAreaSqft: Math.round(manualAreaSqFt * 100) / 100,
          roofSquares,
          pitch: scaleFeet ? `~${Math.round(manualAreaSqFt)} sq ft traced` : undefined,
          sourceReference: file ? `manual-trace:${file.name}` : 'manual-trace',
          notes: manualNotes.trim() || `Traced from image. Scale: ${scalePixels}px = ${scaleFeet}ft.`,
        }),
      })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload.error ?? 'Save failed.')
      setManualSaveState('saved')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed.')
      setManualSaveState('error')
    }
  }

  return (
    <main className="space-y-4">
      <div className="mx-auto max-w-[1240px] p-4 pb-16 md:p-6">

        <header className="mb-5">
          <button onClick={() => smartBack(router)} className="mb-2 text-xs text-cyan-300">← Back</button>
          <p className="ops-label">ROOF/OS · Measurement</p>
          <h1 className="text-3xl font-black">Roof Measurement</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-400">
            <b className="text-white">Two paths.</b> Enter an address for satellite-derived measurements via Google Solar API (free, no image upload needed), or load an inspection photo and trace manually.
          </p>
        </header>

        {/* ── Path 1: Auto / Solar ── */}
        <section className="glass rounded-xl p-4">
          <h2 className="mb-1 text-lg font-semibold">Auto Measurement — Google Solar API</h2>
          <p className="mb-3 text-xs text-slate-400">
            Free satellite roof data: sloped area, sq, pitch, and segment count by address. No image upload or Ollama required.
            Requires <code className="rounded bg-white/10 px-1">GOOGLE_SOLAR_API_KEY</code> in your environment.
          </p>
          <div className="flex flex-wrap gap-2">
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void runSolarMeasurement() }}
              placeholder="123 Main St, Springfield, IL"
              className="flex-1 min-w-[260px] rounded-lg border border-white/15 bg-black/25 p-3 text-white placeholder:text-slate-500 text-sm"
            />
            <button
              onClick={() => void runSolarMeasurement()}
              disabled={working || !address.trim()}
              className="rounded-lg bg-cyan-600 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50 hover:bg-cyan-500"
            >
              {working ? 'Measuring…' : 'Measure Roof'}
            </button>
          </div>

          {status && (
            <p className="mt-3 rounded-lg border border-emerald-400/30 bg-emerald-400/10 p-3 text-sm text-emerald-300" role="status">
              {status}
            </p>
          )}

          {solarResult && (
            <div className="mt-4 space-y-3">
              <div className="rounded-lg border border-cyan-400/20 bg-cyan-400/5 p-4">
                <p className="text-xs text-slate-400 mb-2">{solarResult.address}</p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-lg bg-white/5 p-3 text-center">
                    <p className="text-2xl font-black text-cyan-300">{solarResult.totalSlopedAreaSqFt.toLocaleString()}</p>
                    <p className="text-xs text-slate-400">sq ft (sloped)</p>
                  </div>
                  <div className="rounded-lg bg-white/5 p-3 text-center">
                    <p className="text-2xl font-black text-white">{solarResult.roofSquares.toFixed(1)}</p>
                    <p className="text-xs text-slate-400">squares</p>
                  </div>
                  <div className="rounded-lg bg-white/5 p-3 text-center">
                    <p className="text-2xl font-black text-white">{solarResult.predominantPitch}</p>
                    <p className="text-xs text-slate-400">predominant pitch</p>
                  </div>
                  <div className="rounded-lg bg-white/5 p-3 text-center">
                    <p className="text-2xl font-black text-white">{solarResult.segmentCount}</p>
                    <p className="text-xs text-slate-400">roof facets</p>
                  </div>
                </div>

                {solarResult.facets.length > 1 && (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-xs text-cyan-300 hover:underline">
                      Show {solarResult.facets.length} individual facets
                    </summary>
                    <div className="mt-2 overflow-x-auto">
                      <table className="w-full text-xs text-slate-300">
                        <thead>
                          <tr className="border-b border-white/10 text-slate-400">
                            <th className="py-1 pr-3 text-left">#</th>
                            <th className="py-1 pr-3 text-left">Pitch</th>
                            <th className="py-1 pr-3 text-left">Azimuth</th>
                            <th className="py-1 pr-3 text-right">Sq Ft</th>
                            <th className="py-1 text-right">Squares</th>
                          </tr>
                        </thead>
                        <tbody>
                          {solarResult.facets.map((f) => (
                            <tr key={f.index} className="border-b border-white/5">
                              <td className="py-1 pr-3">{f.index}</td>
                              <td className="py-1 pr-3">{f.pitchString}</td>
                              <td className="py-1 pr-3">{f.azimuthDeg}°</td>
                              <td className="py-1 pr-3 text-right">{f.areaSqFt.toLocaleString()}</td>
                              <td className="py-1 text-right">{f.squares.toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </details>
                )}

                {solarResult.measurement?.id && (
                  <p className="mt-2 text-xs text-emerald-400">
                    Saved to inspection measurements (ID: {solarResult.measurement.id.slice(0, 8)}…)
                  </p>
                )}
                {solarResult.saveError && (
                  <p className="mt-2 text-xs text-amber-400">{solarResult.saveError}</p>
                )}
              </div>
              <p className="text-xs text-amber-300 border border-amber-400/20 rounded-lg bg-amber-400/5 p-3">
                {solarResult.warning}
              </p>
            </div>
          )}
        </section>

        {/* ── Path 2: Manual / image trace ── */}
        <section className="glass mt-4 rounded-xl p-4">
          <h2 className="mb-1 text-lg font-semibold">Manual Measurement — Image Trace</h2>
          <p className="mb-3 text-xs text-slate-400">
            Load an aerial or inspection photo, draw the roof outline, enter a known scale reference, and save the calibrated measurement.
          </p>

          <div className="flex flex-wrap gap-2 mb-3">
            <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={chooseFile} />
            <button
              onClick={() => inputRef.current?.click()}
              className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-600"
            >
              {file ? 'Replace image' : 'Load aerial / inspection image'}
            </button>
            <button
              onClick={() => { setManualMode(!manualMode) }}
              disabled={!file}
              className="rounded-lg border border-white/20 px-4 py-2 text-sm font-semibold text-slate-200 disabled:opacity-40 hover:border-cyan-400/60"
            >
              {manualMode ? 'Exit Drawing Mode' : 'Draw Roof Outline'}
            </button>
          </div>

          {file && (
            <p className="mb-3 text-xs text-slate-400">{file.name} · {imageSize.width}×{imageSize.height}px</p>
          )}

          {/* Scale reference inputs — always visible when image loaded */}
          {file && (
            <div className="mb-3 flex flex-wrap gap-3 items-end">
              <label className="text-xs text-slate-300">
                Known distance (pixels)
                <input
                  type="number"
                  min="1"
                  value={scalePixels}
                  onChange={(e) => setScalePixels(e.target.value)}
                  placeholder="e.g. 240"
                  className="mt-1 block w-36 rounded-lg border border-white/15 bg-black/25 p-2 text-white text-sm"
                />
              </label>
              <label className="text-xs text-slate-300">
                Same distance (feet)
                <input
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={scaleFeet}
                  onChange={(e) => setScaleFeet(e.target.value)}
                  placeholder="e.g. 20"
                  className="mt-1 block w-36 rounded-lg border border-white/15 bg-black/25 p-2 text-white text-sm"
                />
              </label>
              {pixelsPerFoot > 0 && (
                <p className="text-xs text-emerald-400 self-end pb-2">
                  Scale: {pixelsPerFoot.toFixed(2)} px/ft
                </p>
              )}
            </div>
          )}

          {manualMode && (
            <ManualDrawingTool
              imageUrl={preview}
              imageWidth={imageSize.width || 500}
              imageHeight={imageSize.height || 500}
              scalePixels={Number(scalePixels) || 0}
              scaleFeet={Number(scaleFeet) || 0}
              onAreaCalculated={(area) => {
                setManualAreaPx(area)
                setManualSaveState('idle')
              }}
            />
          )}

          {/* Save manual result */}
          {manualAreaPx > 0 && (
            <div className="mt-4 rounded-lg border border-white/10 bg-white/5 p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div className="rounded-lg bg-white/5 p-3 text-center">
                  <p className="text-2xl font-black text-white">{Math.round(manualAreaPx).toLocaleString()}</p>
                  <p className="text-xs text-slate-400">traced px²</p>
                </div>
                <div className="rounded-lg bg-white/5 p-3 text-center">
                  <p className={`text-2xl font-black ${manualAreaSqFt > 0 ? 'text-cyan-300' : 'text-slate-500'}`}>
                    {manualAreaSqFt > 0 ? Math.round(manualAreaSqFt).toLocaleString() : '—'}
                  </p>
                  <p className="text-xs text-slate-400">sq ft</p>
                </div>
                <div className="rounded-lg bg-white/5 p-3 text-center">
                  <p className={`text-2xl font-black ${manualAreaSqFt > 0 ? 'text-white' : 'text-slate-500'}`}>
                    {manualAreaSqFt > 0 ? (manualAreaSqFt / 100).toFixed(2) : '—'}
                  </p>
                  <p className="text-xs text-slate-400">squares</p>
                </div>
              </div>

              {manualAreaSqFt <= 0 && (
                <p className="text-xs text-amber-400">Enter a scale reference above to convert px² to sq ft.</p>
              )}

              <label className="block text-xs text-slate-300">
                Notes (optional)
                <textarea
                  value={manualNotes}
                  onChange={(e) => setManualNotes(e.target.value)}
                  rows={2}
                  maxLength={1000}
                  placeholder="e.g. traced from drone photo, pitch estimated 6/12"
                  className="mt-1 w-full rounded-lg border border-white/15 bg-black/25 p-2 text-white text-sm resize-none"
                />
              </label>

              <button
                onClick={() => void saveManualMeasurement()}
                disabled={manualSaveState === 'saving' || manualAreaSqFt <= 0}
                className="rounded-lg bg-green-600 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50 hover:bg-green-500"
              >
                {manualSaveState === 'saving' ? 'Saving…' : manualSaveState === 'saved' ? '✓ Saved' : 'Save Measurement'}
              </button>

              {manualSaveState === 'saved' && (
                <p className="text-xs text-emerald-400">
                  Saved as unverified manual measurement. Review and confirm before use in estimates.
                </p>
              )}
            </div>
          )}
        </section>

        <section className="glass mt-4 rounded-xl p-4">
          <RoofSlopeCard />
        </section>

        {error && (
          <p className="mt-3 rounded-lg border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-300" role="alert">
            {error}
          </p>
        )}

      </div>
    </main>
  )
}
