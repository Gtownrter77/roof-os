'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase/client'
import { createWorker } from 'tesseract.js'

type Photo = { file: File; preview: string; id: string }

export default function PhotoEstimatePage() {
  const router = useRouter()
  const supabase = createClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const [photos, setPhotos] = useState<Photo[]>([])
  const [address, setAddress] = useState('')
  const [roofSquares, setRoofSquares] = useState('')
  const [gutterLf, setGutterLf] = useState('')
  const [photoIds, setPhotoIds] = useState<string[]>([])
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [working, setWorking] = useState(false)
  const [ocrWorking, setOcrWorking] = useState(false)
  const [workflow, setWorkflow] = useState<any>(null)
  const [eaveLf, setEaveLf] = useState('')
  const [rafterLf, setRafterLf] = useState('')
  const [pitch, setPitch] = useState('')
  const [roofType, setRoofType] = useState<'hip' | 'gable' | 'other'>('hip')
  const [wasteFactor, setWasteFactor] = useState('0.10')
  const [soffitWidthFt, setSoffitWidthFt] = useState('1')
  const [fasciaWidthFt, setFasciaWidthFt] = useState('0.5')

  function chooseFiles(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []).filter((file) => file.type.startsWith('image/'))
    setPhotos((current) => [...current, ...selected.map((file) => ({ file, preview: URL.createObjectURL(file), id: crypto.randomUUID() }))])
    event.target.value = ''
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

  async function uploadPhotos() {
    if (!photos.length) throw new Error('Add at least one roof/property photo.')
    const { data: { user } } = await supabase.auth.getUser()
    const { data: workspaceId } = await supabase.rpc('current_workspace_id')
    if (!user || !workspaceId) throw new Error('Sign in with a workspace before uploading.')
    const ids: string[] = []
    for (const photo of photos) {
      const path = `${workspaceId}/${user.id}/photo-estimate/${photo.id}.${photo.file.name.split('.').pop()?.toLowerCase() || 'jpg'}`
      const { error: uploadError } = await supabase.storage.from('inspection-photos').upload(path, photo.file, { contentType: photo.file.type, upsert: false })
      if (uploadError) throw new Error(uploadError.message)
      ids.push(path)
    }
    return ids
  }

  async function buildPacket() {
    setWorking(true); setError(''); setMessage('')
    try {
      const ids = photoIds.length ? photoIds : await uploadPhotos()
      setPhotoIds(ids)
      if (!address.trim()) throw new Error('Enter or confirm the property address before evidence lookup.')
      const response = await fetch('/api/photo-estimate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ address, roofSquares: Number(roofSquares || 0), gutterLf: Number(gutterLf || 0), photoIds: ids }) })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.detail || payload.error || 'Could not build the review packet.')
      setWorkflow(payload.workflow)
      setMessage('Review packet created. Verify every finding before any customer delivery.')
    } catch (err) { setError(err instanceof Error ? err.message : 'Workflow failed.') }
    setWorking(false)
  }

  async function saveFieldVerification(action: 'verify' | 'refresh') {
    if (!workflow?.id) return
    setWorking(true); setError(''); setMessage('')
    try {
      const response = await fetch(`/api/photo-estimate/verify?workflowId=${encodeURIComponent(workflow.id)}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, eaveLf: Number(eaveLf), rafterLf: Number(rafterLf), pitch: Number(pitch), roofType, wasteFactor: Number(wasteFactor), soffitWidthFt: Number(soffitWidthFt), fasciaWidthFt: Number(fasciaWidthFt), notes: action === 'refresh' ? 'Technician requested a fresh photo set.' : undefined }) })
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
    <input ref={inputRef} type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={chooseFiles} />
    <button onClick={() => inputRef.current?.click()} className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold">{photos.length ? `Add photos (${photos.length})` : 'Take or upload photos'}</button>
    {photos.length > 0 && <><div className="grid grid-cols-3 gap-2 mt-3">{photos.map((photo) => <img key={photo.id} src={photo.preview} alt="Uploaded roof evidence" className="h-24 w-full object-cover rounded" />)}</div><button onClick={() => void findAddressInPhotos()} disabled={ocrWorking} className="w-full mt-3 bg-purple-600 text-white py-2 rounded-lg disabled:opacity-60">{ocrWorking ? 'Reading photo text…' : 'Find address text in photo'}</button></>}
    <div className="bg-white rounded-lg shadow p-4 mt-4 space-y-3">
      <h2 className="font-semibold">Property confirmation</h2>
      <label className="block text-sm">Address to verify<input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Confirm the property address" className="w-full p-3 border rounded mt-1" /></label>
      <div className="grid grid-cols-2 gap-3"><label className="block text-sm">Roof squares<input value={roofSquares} onChange={(e) => setRoofSquares(e.target.value)} inputMode="decimal" placeholder="Optional" className="w-full p-3 border rounded mt-1" /></label><label className="block text-sm">Gutter LF<input value={gutterLf} onChange={(e) => setGutterLf(e.target.value)} inputMode="decimal" placeholder="Optional" className="w-full p-3 border rounded mt-1" /></label></div>
      <button onClick={() => void buildPacket()} disabled={working} className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold disabled:opacity-60">{working ? 'Uploading and building review packet…' : 'Build review packet'}</button>
    </div>
    {error && <p className="text-red-700 bg-red-50 p-3 rounded mt-4 text-sm">{error}</p>}
    {message && <p className="text-green-700 bg-green-50 p-3 rounded mt-4 text-sm">{message}</p>}
    {workflow && <div className="bg-white rounded-lg shadow p-4 mt-4"><h2 className="font-bold">{workflow.report?.title}</h2><p className="text-sm mt-2">Status: <b>{workflow.status}</b></p><p className="text-sm">Property footprint assist: {workflow.report?.propertyEvidence?.footprintSqFt || 0} sq ft, low confidence</p><p className="text-sm">Storm candidates: {workflow.storm_candidates?.length || 0}; these are corroborating candidates, not a proven loss date.</p><p className="text-sm mt-3">Estimate: {workflow.estimate?.status}; no prices are inserted unless an approved price book is present.</p><div className="mt-3 border-t pt-3"><h3 className="font-semibold">Technician field verification</h3><p className="text-xs text-gray-600 mb-2">Review the packet, then choose exactly one action. The server preserves your measurements and does not decide whether they are plausible.</p><div className="grid grid-cols-2 gap-2"><input value={eaveLf} onChange={(e) => setEaveLf(e.target.value)} placeholder="Eaves LF" className="p-2 border rounded" /><input value={rafterLf} onChange={(e) => setRafterLf(e.target.value)} placeholder="Rafter LF" className="p-2 border rounded" /><input value={pitch} onChange={(e) => setPitch(e.target.value)} placeholder="Pitch rise / 12" className="p-2 border rounded" /><select value={roofType} onChange={(e) => setRoofType(e.target.value as 'hip' | 'gable' | 'other')} className="p-2 border rounded"><option value="hip">Hip</option><option value="gable">Gable</option><option value="other">Other</option></select><input value={soffitWidthFt} onChange={(e) => setSoffitWidthFt(e.target.value)} placeholder="Soffit width (ft)" className="p-2 border rounded" /><input value={fasciaWidthFt} onChange={(e) => setFasciaWidthFt(e.target.value)} placeholder="Fascia width (ft)" className="p-2 border rounded" /></div><p className="text-xs text-gray-500 mt-1">The technician owns the measurement decision. Values are preserved as entered.</p><select value={wasteFactor} onChange={(e) => setWasteFactor(e.target.value)} className="w-full p-2 border rounded mt-2"><option value="0.10">10% waste</option><option value="0.15">15% waste</option><option value="0">0% waste</option></select><div className="grid grid-cols-2 gap-2 mt-2"><button onClick={() => void saveFieldVerification('refresh')} disabled={working} className="bg-amber-500 text-white py-2 rounded disabled:opacity-60">Request photo refresh</button><button onClick={() => void saveFieldVerification('verify')} disabled={working} className="bg-green-600 text-white py-2 rounded disabled:opacity-60">Verify measurements</button></div></div><div className="mt-3 bg-amber-50 p-3 rounded text-sm">Verify records the technician, timestamp, measurements, slope multiplier, roof type, waste factor, soffit/fascia widths, and calculated squares. Refresh preserves the existing packet and returns it for new photos.</div></div>}
  </div>
}
