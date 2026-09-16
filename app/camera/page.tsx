'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '../../lib/supabase/client'

type PendingPhoto = { file: File; preview: string }

function CameraInner() {
  const router = useRouter()
  const search = useSearchParams()
  const supabase = createClient()
  const [photos, setPhotos] = useState<PendingPhoto[]>([])
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [inspectionId, setInspectionId] = useState(search.get('inspection') || '')
  const leadId = search.get('lead') || ''
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => () => photos.forEach((photo) => URL.revokeObjectURL(photo.preview)), [photos])

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []).filter((file) => file.type.startsWith('image/'))
    setPhotos((current) => [...current, ...files.map((file) => ({ file, preview: URL.createObjectURL(file) }))])
    event.target.value = ''
  }

  const ensureInspection = async (userId: string, workspaceId: string) => {
    if (inspectionId) return inspectionId
    const { data, error: insertError } = await supabase.from('inspection_sessions').insert({ workspace_id: workspaceId, lead_id: leadId || null, created_by: userId, status: 'in_progress' }).select('id').single()
    if (insertError || !data) throw new Error(insertError?.message ?? 'Could not start an inspection session.')
    setInspectionId(data.id)
    return data.id
  }

  const savePhotos = async () => {
    if (photos.length === 0) { setError('Please take at least one photo'); return }
    setSaving(true); setError(''); setMessage('')
    const { data: { user } } = await supabase.auth.getUser()
    const { data: workspaceId } = await supabase.rpc('current_workspace_id')
    if (!user || !workspaceId) { setError('Sign in with a workspace before uploading photos.'); setSaving(false); return }
    try {
      const sessionId = await ensureInspection(user.id, workspaceId)
      for (const photo of photos) {
        const extension = photo.file.name.split('.').pop()?.toLowerCase() || 'jpg'
        const photoId = crypto.randomUUID()
        const path = `${workspaceId}/${user.id}/${sessionId}/${photoId}.${extension}`
        const { error: uploadError } = await supabase.storage.from('inspection-photos').upload(path, photo.file, { contentType: photo.file.type, upsert: false })
        if (uploadError) throw new Error(uploadError.message)
        const { error: metaError } = await supabase.from('inspection_photos').insert({ inspection_id: sessionId, workspace_id: workspaceId, uploaded_by: user.id, object_path: path, mime_type: photo.file.type || 'image/jpeg', file_size_bytes: photo.file.size, album: 'damage', upload_status: 'uploaded' })
        if (metaError) throw new Error(metaError.message)
      }
      if (leadId) await supabase.from('leads').update({ status: 'inspected', updated_at: new Date().toISOString() }).eq('id', leadId)
      setMessage(`${photos.length} photo${photos.length === 1 ? '' : 's'} saved to inspection ${sessionId.slice(0, 8)}.`)
      photos.forEach((photo) => URL.revokeObjectURL(photo.preview))
      setPhotos([])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.')
    }
    setSaving(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <header className="bg-blue-600 text-white shadow-lg sticky top-0 z-10"><div className="px-4 py-3 flex items-center"><button onClick={() => router.back()} className="text-white mr-3 text-xl">←</button><h1 className="text-xl font-bold">Camera</h1></div></header>
      <main className="p-4">
        <p className="text-xs text-gray-500 mb-3">{inspectionId ? `Inspection ${inspectionId.slice(0, 8)}` : 'A new inspection session will be created on upload.'}{leadId ? ' · linked lead' : ''}</p>
        <input type="file" ref={fileInputRef} accept="image/*" capture="environment" multiple className="hidden" onChange={handleFileSelect} />
        <button onClick={() => fileInputRef.current?.click()} className="w-full bg-blue-600 text-white py-4 rounded-lg font-semibold text-lg">Take photo</button>
        {error && <p className="text-sm text-red-600 mt-4">{error}</p>}
        {message && <p className="text-sm text-green-700 mt-4">{message}</p>}
        {photos.length > 0 && (
          <div className="mt-6">
            <div className="flex justify-between items-center mb-3"><h2 className="font-semibold text-sm">Photos ({photos.length})</h2><button onClick={() => void savePhotos()} disabled={saving} className="bg-green-600 text-white px-4 py-1 rounded text-sm disabled:opacity-60">{saving ? 'Uploading…' : 'Upload all'}</button></div>
            <div className="grid grid-cols-2 gap-3">{photos.map((photo, index) => <div key={photo.preview} className="relative bg-white rounded-lg shadow overflow-hidden"><img src={photo.preview} alt={`Photo ${index + 1}`} className="w-full h-40 object-cover" /></div>)}</div>
          </div>
        )}
      </main>
    </div>
  )
}

export default function CameraPage() {
  return <Suspense fallback={<p className="p-4 text-sm text-gray-500">Loading camera…</p>}><CameraInner /></Suspense>
}
