'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase/client'

type PendingPhoto = { file: File; preview: string }

export default function CameraPage() {
  const router = useRouter()
  const supabase = createClient()
  const [photos, setPhotos] = useState<PendingPhoto[]>([])
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => () => photos.forEach((photo) => URL.revokeObjectURL(photo.preview)), [photos])

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []).filter((file) => file.type.startsWith('image/'))
    setPhotos((current) => [...current, ...files.map((file) => ({ file, preview: URL.createObjectURL(file) }))])
    event.target.value = ''
  }

  const deletePhoto = (index: number) => setPhotos((current) => { URL.revokeObjectURL(current[index].preview); return current.filter((_, i) => i !== index) })

  const savePhotos = async () => {
    if (photos.length === 0) { setError('Please take at least one photo'); return }
    setSaving(true); setError(''); setMessage('')
    const { data: { user } } = await supabase.auth.getUser()
    const { data: workspaceId } = await supabase.rpc('current_workspace_id')
    if (!user || !workspaceId) { setError('Sign in with a workspace before uploading photos.'); setSaving(false); return }
    for (const photo of photos) {
      const extension = photo.file.name.split('.').pop()?.toLowerCase() || 'jpg'
      const path = `${workspaceId}/${user.id}/${crypto.randomUUID()}.${extension}`
      const { error: uploadError } = await supabase.storage.from('inspection-photos').upload(path, photo.file, { contentType: photo.file.type, upsert: false })
      if (uploadError) { setError(uploadError.message); setSaving(false); return }
    }
    setMessage(`${photos.length} photo${photos.length === 1 ? '' : 's'} uploaded securely.`)
    photos.forEach((photo) => URL.revokeObjectURL(photo.preview))
    setPhotos([]); setSaving(false)
  }

  return <div className="min-h-screen bg-gray-50 pb-20"><header className="bg-blue-600 text-white shadow-lg sticky top-0 z-10"><div className="px-4 py-3 flex items-center"><button onClick={() => router.back()} className="text-white mr-3 text-xl">←</button><h1 className="text-xl font-bold">📷 Camera</h1></div></header><main className="p-4"><input type="file" ref={fileInputRef} accept="image/*" capture="environment" multiple className="hidden" onChange={handleFileSelect}/><button onClick={() => fileInputRef.current?.click()} className="w-full bg-blue-600 text-white py-4 rounded-lg font-semibold text-lg">📸 Take Photo</button><p className="text-xs text-gray-400 text-center mt-2">Photos upload to your private Supabase inspection storage.</p>{error && <p className="text-sm text-red-600 mt-4" role="alert">{error}</p>}{message && <p className="text-sm text-green-700 mt-4" role="status">{message}</p>}{photos.length > 0 && <div className="mt-6"><div className="flex justify-between items-center mb-3"><h2 className="font-semibold text-sm text-gray-700">Photos ({photos.length})</h2><button onClick={savePhotos} disabled={saving} className="bg-green-600 text-white px-4 py-1 rounded text-sm disabled:opacity-60">{saving ? 'Uploading…' : 'Upload All'}</button></div><div className="grid grid-cols-2 gap-3">{photos.map((photo, index) => <div key={photo.preview} className="relative bg-white rounded-lg shadow overflow-hidden"><img src={photo.preview} alt={`Photo ${index + 1}`} className="w-full h-40 object-cover"/><button onClick={() => deletePhoto(index)} className="absolute top-1 right-1 bg-red-600 text-white rounded-full w-6 h-6">✕</button></div>)}</div></div>}{photos.length === 0 && !message && <div className="mt-8 bg-white rounded-lg shadow p-8 text-center"><div className="text-6xl mb-4">📷</div><p className="text-gray-400">No photos selected</p></div>}</main><nav className="fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around py-2 px-4"><button onClick={() => router.push('/')} className="text-gray-400 text-sm">🏠 Home</button><button onClick={() => router.push('/leads')} className="text-gray-400 text-sm">👤 Leads</button><button onClick={() => router.push('/camera')} className="text-blue-600 text-sm">📷 Camera</button><button onClick={() => router.push('/weather')} className="text-gray-400 text-sm">🌤️ Weather</button></nav></div>
}
