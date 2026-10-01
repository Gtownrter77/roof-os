'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase/client'
import { createWorker } from 'tesseract.js'

type Photo = { file: File; preview: string; id: string }
type AIObservation = {
  summary: string
  authority_disclaimer: string
  roof_classification: { roof_style: string; primary_material: string }
  damage_observations: Array<{ category: string; severity: string; location_description: string }>
  warnings: string[]
}

const MAX_PHOTOS = 50
const MAX_PHOTO_BYTES = 30 * 1024 * 1024
const MIME_EXTENSIONS: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }

export default function PhotoEstimatePage() {
  const router = useRouter()
  const [supabase] = useState(() => createClient())
  const inputRef = useRef<HTMLInputElement>(null)
  const [photos, setPhotos] = useState<Photo[]>([])
  const [address, setAddress] = useState('')
  const [roofSquares, setRoofSquares] = useState('')
  const [gutterLf, setGutterLf] = useState('')
  const [photoIds, setPhotoIds] = useState<string[]>([])
  const [inspectionId, setInspectionId] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [working, setWorking] = useState(false)
  const [ocrWorking, setOcrWorking] = useState(false)
  const [workflow, setWorkflow] = useState<any>(null)
  const [canRunAI, setCanRunAI] = useState(false)
  const [adminCheckComplete, setAdminCheckComplete] = useState(false)
  const [aiAnalysis, setAiAnalysis] = useState<AIObservation | null>(null)
  const [eaveLf, setEaveLf] = useState('')
  const [rafterLf, setRafterLf] = useState('')
  const [pitch, setPitch] = useState('')
  const [roofType, setRoofType] = useState<'hip' | 'gable' | 'other'>('hip')
  const [wasteFactor, setWasteFactor] = useState('0.10')
  const [soffitWidthFt, setSoffitWidthFt] = useState('1')
  const [fasciaWidthFt, setFasciaWidthFt] = useState('0.5')
  const [verifiedGutterLf, setVerifiedGutterLf] = useState('')

  useEffect(() => {
    let active = true
    async function checkWorkspaceAdmin() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data: workspaceId, error: workspaceError } = await supabase.rpc('current_workspace_id')
        if (workspaceError || !workspaceId) return
        const { data: isAdmin, error: roleError } = await supabase.rpc('is_workspace_admin', { target_workspace: workspaceId })
        if (active && !roleError && isAdmin === true) setCanRunAI(true)
      } catch {
        // The analysis endpoint independently enforces workspace-admin access.
      } finally {
        if (active) setAdminCheckComplete(true)
      }
    }
    void checkWorkspaceAdmin()
    return () => { active = false }
  }, [supabase])

  function chooseFiles(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? [])
    event.target.value = ''
    const supported = selected.filter((file) => Object.hasOwn(MIME_EXTENSIONS, file.type) && file.size > 0)
    const unsupportedCount = selected.length - supported.length
    const next = [...photos]
    let totalBytes = next.reduce((sum, photo) => sum + photo.file.size, 0)
    let limitReached = false
    for (const file of supported) {
      if (next.length >= MAX_PHOTOS || totalBytes + file.size > MAX_PHOTO_BYTES) {
        limitReached = true
        continue
      }
      totalBytes += file.size
      next.push({ file, preview: URL.createObjectURL(file), id: crypto.randomUUID() })
    }
    setPhotos(next)
    if (unsupportedCount || limitReached) {
      setError(`Only JPEG, PNG, and WebP photos are supported, up to ${MAX_PHOTOS} photos and 30 MB total.`)
    } else {
      setError('')
    }
    if (workflow && next.length > photos.length) {
      setWorkflow(null)
      setAiAnalysis(null)
      setVerifiedGutterLf('')
      setMessage('Additional photos selected. Build a new review packet to include them.')
    }
  }

  async function findAddressInPhotos() {
    if (!photos.length) { setError('Add a photo containing a visible address first.'); return }
    setOcrWorking(true); setError(''); setMessage('Reading visible text from the photo…')
    const worker = await createWorker('eng')
    try {
      const results: string[] = []
      for (const photo of photos.slice(0, 3)) {
        const result = await worker.recognize(photo.file)
        if (result.data.text.trim()) results.push(result.data.text.trim())
      }
      const candidate = results.join(' ').replace(/\s+/g, ' ').trim()
      setAddress(candidate)
      setMessage(candidate ? 'Address candidate found from visible photo text. Confirm or edit it before continuing.' : 'No readable address text was found. Enter or confirm the property address manually.')
    } catch (err) { setError(err instanceof Error ? err.message : 'Photo text recognition failed.') }
    finally { await worker.terminate(); setOcrWorking(false) }
  }

  async function uploadPhotos(): Promise<{ ids: string[]; inspectionId: string }> {
    if (!photos.length) throw new Error('Add at least one roof/property photo.')
    const { data: { user } } = await supabase.auth.getUser()
    const { data: workspaceId } = await supabase.rpc('current_workspace_id')
    if (!user || !workspaceId) throw new Error('Sign in with a workspace before uploading.')

    let activeInspectionId = inspectionId
    if (!activeInspectionId) {
      const { data: inspection, error: inspectionError } = await supabase
        .from('inspection_sessions')
        .insert({ workspace_id: workspaceId, created_by: user.id, status: 'in_progress' })
        .select('id')
        .single()
      if (inspectionError || !inspection) throw new Error('Could not start an inspection session for these photos.')
      activeInspectionId = inspection.id
      setInspectionId(activeInspectionId)
    }

    const ids = [...photoIds]
    for (const photo of photos) {
      if (ids.includes(photo.id)) continue
      const extension = MIME_EXTENSIONS[photo.file.type]
      if (!extension) throw new Error('Only JPEG, PNG, and WebP photos are supported.')
      const objectId = crypto.randomUUID()
      const path = `${workspaceId}/${user.id}/${activeInspectionId}/${objectId}.${extension}`
      const { error: uploadError } = await supabase.storage.from('inspection-photos').upload(path, photo.file, { contentType: photo.file.type, upsert: false })
      if (uploadError) throw new Error('A photo could not be uploaded. Please retry.')
      const { error: metadataError } = await supabase.from('inspection_photos').insert({
        id: photo.id,
        inspection_id: activeInspectionId,
        workspace_id: workspaceId,
        uploaded_by: user.id,
        bucket_id: 'inspection-photos',
        object_path: path,
        mime_type: photo.file.type,
        file_size_bytes: photo.file.size,
        upload_status: 'uploaded',
      })
      if (metadataError) {
        await supabase.storage.from('inspection-photos').remove([path]).catch(() => undefined)
        throw new Error('Photo metadata could not be saved. Please retry.')
      }
      ids.push(photo.id)
      setPhotoIds([...ids])
    }
    return { ids, inspectionId: activeInspectionId }
  }

  async function buildPacket() {
    setWorking(true); setError(''); setMessage('')
    try {
      if (!address.trim()) throw new Error('Enter or confirm the property address before evidence lookup.')
      const uploaded = photoIds.length && inspectionId ? { ids: photoIds, inspectionId } : await uploadPhotos()
      setPhotoIds(uploaded.ids)
      setInspectionId(uploaded.inspectionId)
      const response = await fetch('/api/photo-estimate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ address, roofSquares: Number(roofSquares || 0), gutterLf: Number(gutterLf || 0), photoIds: uploaded.ids, inspectionId: uploaded.inspectionId }) })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.detail || payload.error || 'Could not build the review packet.')
      setWorkflow(payload.workflow)
      setAiAnalysis(null)
      setVerifiedGutterLf('')
      setMessage('Review packet created. Verify every finding before any customer delivery.')
    } catch (err) { setError(err instanceof Error ? err.message : 'Workflow failed.') }
    setWorking(false)
  }

  async function analyzePhotos(forceRefresh = false) {
    if (!workflow?.id || !canRunAI || working) return
    setWorking(true); setError(''); setMessage('')
    try {
      const response = await fetch('/api/photo-estimate/analyze', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ workflowId: workflow.id, ...(forceRefresh ? { forceRefresh: true } : {}) }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error || 'Photo analysis could not be completed.')
      if (!payload?.analysis) throw new Error('Photo analysis returned no usable observation packet.')
      setAiAnalysis(payload.analysis as AIObservation)
      setMessage(payload.cached ? 'Loaded the saved AI visual observations.' : 'AI visual observations saved for technician review.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Photo analysis could not be completed.')
    } finally {
      setWorking(false)
    }
  }

  async function saveFieldVerification(action: 'verify' | 'refresh') {
    if (!workflow?.id) return
    if (action === 'verify' && !verifiedGutterLf.trim()) {
      setError('Enter the technician-measured gutter length, or enter 0 if there are no gutters.')
      return
    }
    setWorking(true); setError(''); setMessage('')
    try {
      const verification = action === 'verify'
        ? { eaveLf: Number(eaveLf), rafterLf: Number(rafterLf), pitch: Number(pitch), roofType, wasteFactor: Number(wasteFactor), soffitWidthFt: Number(soffitWidthFt), fasciaWidthFt: Number(fasciaWidthFt), gutterLf: Number(verifiedGutterLf) }
        : { notes: 'Technician requested a fresh photo set.' }
      const response = await fetch(`/api/photo-estimate/verify?workflowId=${encodeURIComponent(workflow.id)}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, ...verification }) })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.detail || payload.error || 'Could not save field verification.')
      setWorkflow((current: any) => ({ ...current, ...payload.workflow }))
      setMessage(action === 'verify' ? 'Technician verification saved. The packet is approved for controlled customer-packet creation.' : 'Photo refresh requested. Existing measurements and photos were preserved.')
    } catch (err) { setError(err instanceof Error ? err.message : 'Verification failed.') }
    setWorking(false)
  }

  return <div className="min-h-screen bg-gray-50 p-4 pb-24">
    <button onClick={() => router.back()} className="text-blue-600 mb-4">← Back</button>
    <h1 className="text-2xl font-bold">Photo → Estimate Review</h1>
    <p className="text-sm text-gray-600 mt-1 mb-4">Upload evidence first. The system assembles address, property, storm, measurement, pricing, and report candidates. A technician must verify the packet before it can be sent.</p>
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-900 mb-4"><b>Important:</b> OCR can read visible address text; it cannot prove a roof photo’s location. Confirm the property and quantities before approval.</div>
    <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" multiple className="hidden" onChange={chooseFiles} />
    <button onClick={() => inputRef.current?.click()} className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold">{photos.length ? `Add photos (${photos.length})` : 'Take or upload photos'}</button>
    {photos.length > 0 && <><div className="grid grid-cols-3 gap-2 mt-3">{photos.map((photo) => <img key={photo.id} src={photo.preview} alt="Uploaded roof evidence" className="h-24 w-full object-cover rounded" />)}</div><button onClick={() => void findAddressInPhotos()} disabled={ocrWorking} className="w-full mt-3 bg-purple-600 text-white py-2 rounded-lg disabled:opacity-60">{ocrWorking ? 'Reading photo text…' : 'Find address text in photo'}</button></>}
    <div className="bg-white rounded-lg shadow p-4 mt-4 space-y-3">
      <h2 className="font-semibold">Property confirmation</h2>
      <label className="block text-sm">Address to verify<input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Confirm the property address" className="w-full p-3 border rounded mt-1" /></label>
      <div className="grid grid-cols-2 gap-3"><label className="block text-sm">Roof squares<input value={roofSquares} onChange={(e) => setRoofSquares(e.target.value)} inputMode="decimal" placeholder="Optional" className="w-full p-3 border rounded mt-1" /></label><label className="block text-sm">Gutter LF<input value={gutterLf} onChange={(e) => setGutterLf(e.target.value)} inputMode="decimal" placeholder="Optional" className="w-full p-3 border rounded mt-1" /></label></div>
      <p className="text-xs text-gray-600">These initial quantities are unverified candidates. Estimate drafts use only the quantities entered again and approved in technician verification below.</p>
      <button onClick={() => void buildPacket()} disabled={working} className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold disabled:opacity-60">{working ? 'Uploading and building review packet…' : 'Build review packet'}</button>
    </div>
    {error && <p className="text-red-700 bg-red-50 p-3 rounded mt-4 text-sm">{error}</p>}
    {message && <p className="text-green-700 bg-green-50 p-3 rounded mt-4 text-sm">{message}</p>}
    {workflow && <section className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4" aria-labelledby="ai-observations-title">
      <h2 id="ai-observations-title" className="font-semibold">AI visual observations (non-authoritative)</h2>
      <p className="text-xs text-gray-700 mt-1">Analysis is optional and starts only when an administrator requests it. Results are not measurements, pricing, code determinations, or insurance decisions; a technician must independently verify all findings.</p>
      {canRunAI ? <div className="flex flex-wrap gap-2 mt-3">
        <button onClick={() => void analyzePhotos(false)} disabled={working} className="bg-blue-700 text-white px-3 py-2 rounded disabled:opacity-60">{working ? 'Analyzing photos…' : 'Analyze roof photos'}</button>
        {aiAnalysis && <button onClick={() => void analyzePhotos(true)} disabled={working} className="border border-blue-700 text-blue-800 px-3 py-2 rounded disabled:opacity-60">Force fresh analysis</button>}
      </div> : adminCheckComplete ? <p className="text-xs text-gray-600 mt-2">Workspace administrator access is required to run or refresh AI analysis.</p> : <p className="text-xs text-gray-600 mt-2">Checking workspace permissions…</p>}
      {aiAnalysis && <div className="mt-3 bg-white rounded p-3 space-y-2">
        <p className="text-sm">{aiAnalysis.summary}</p>
        <p className="text-sm"><b>Visual classification:</b> {aiAnalysis.roof_classification.roof_style.replaceAll('_', ' ')}; {aiAnalysis.roof_classification.primary_material.replaceAll('_', ' ')}.</p>
        <p className="text-sm"><b>Damage observations:</b> {aiAnalysis.damage_observations.length} candidate(s).</p>
        {aiAnalysis.damage_observations.length > 0 && <ul className="list-disc pl-5 text-sm">{aiAnalysis.damage_observations.map((item, index) => <li key={`${item.category}-${index}`}>{item.category.replaceAll('_', ' ')} — {item.severity}; {item.location_description}</li>)}</ul>}
        {aiAnalysis.warnings.length > 0 && <ul className="list-disc pl-5 text-xs text-amber-800">{aiAnalysis.warnings.map((warning, index) => <li key={`${warning}-${index}`}>{warning}</li>)}</ul>}
        <p className="text-xs text-gray-600">{aiAnalysis.authority_disclaimer}</p>
      </div>}
    </section>}
    {workflow && <div className="bg-white rounded-lg shadow p-4 mt-4"><h2 className="font-bold">{workflow.report?.title}</h2><p className="text-sm mt-2">Status: <b>{workflow.status}</b></p><p className="text-sm">Property footprint assist: {workflow.report?.propertyEvidence?.footprintSqFt || 0} sq ft, low confidence</p><p className="text-sm">Storm candidates: {workflow.storm_candidates?.length || 0}; these are corroborating candidates, not a proven loss date.</p><p className="text-sm mt-3">Estimate: {workflow.estimate?.status}; no prices are inserted unless an approved price book is present.</p><div className="mt-3 border-t pt-3"><h3 className="font-semibold">Technician field verification</h3><p className="text-xs text-gray-600 mb-2">Review the packet, then choose exactly one action. The server preserves your measurements and does not decide whether they are plausible.</p><div className="grid grid-cols-2 gap-2"><input value={eaveLf} onChange={(e) => setEaveLf(e.target.value)} placeholder="Eaves LF" className="p-2 border rounded" /><input value={rafterLf} onChange={(e) => setRafterLf(e.target.value)} placeholder="Rafter LF" className="p-2 border rounded" /><input value={pitch} onChange={(e) => setPitch(e.target.value)} placeholder="Pitch rise / 12" className="p-2 border rounded" /><select value={roofType} onChange={(e) => setRoofType(e.target.value as 'hip' | 'gable' | 'other')} className="p-2 border rounded"><option value="hip">Hip</option><option value="gable">Gable</option><option value="other">Other</option></select><input value={soffitWidthFt} onChange={(e) => setSoffitWidthFt(e.target.value)} placeholder="Soffit width (ft)" className="p-2 border rounded" /><input value={fasciaWidthFt} onChange={(e) => setFasciaWidthFt(e.target.value)} placeholder="Fascia width (ft)" className="p-2 border rounded" /><label className="block text-sm col-span-2">Technician-measured gutter length (LF; enter 0 if none)<input type="number" min="0" max="10000" step="0.01" inputMode="decimal" value={verifiedGutterLf} onChange={(e) => setVerifiedGutterLf(e.target.value)} placeholder="Required for approval" className="w-full p-2 border rounded mt-1" /></label></div><p className="text-xs text-gray-500 mt-1">The technician owns the measurement decision. Roof dimensions and gutter length are saved with the approver and timestamp; only these approved values can create estimate drafts.</p><select value={wasteFactor} onChange={(e) => setWasteFactor(e.target.value)} className="w-full p-2 border rounded mt-2"><option value="0.10">10% waste</option><option value="0.15">15% waste</option><option value="0">0% waste</option></select><div className="grid grid-cols-2 gap-2 mt-2"><button onClick={() => void saveFieldVerification('refresh')} disabled={working} className="bg-amber-500 text-white py-2 rounded disabled:opacity-60">Request photo refresh</button><button onClick={() => void saveFieldVerification('verify')} disabled={working} className="bg-green-600 text-white py-2 rounded disabled:opacity-60">Verify measurements</button></div></div><div className="mt-3 bg-amber-50 p-3 rounded text-sm">Verify records the technician, timestamp, roof and gutter measurements, slope multiplier, roof type, waste factor, soffit/fascia widths, and calculated squares. Refresh preserves the existing packet and returns it for new photos.</div></div>}
  </div>
}
