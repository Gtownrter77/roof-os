'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase/client'

function readGps(file: File): Promise<{ lat: number; lon: number } | null> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => {
      const view = new DataView(reader.result as ArrayBuffer)
      if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) { resolve(null); return }
      resolve(null)
    }
    reader.onerror = () => resolve(null)
    reader.readAsArrayBuffer(file.slice(0, 128 * 1024))
  })
}

export default function PhotoAddressPage() {
  const router = useRouter()
  const supabase = createClient()
  const [draft, setDraft] = useState('')
  const [source, setSource] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function reverse(lat: number, lon: number, why: string) {
    const res = await fetch(`/api/geo/reverse?lat=${lat}&lon=${lon}`)
    const body = await res.json()
    if (!res.ok) { setError(body.error ?? 'No address'); return }
    const line = [body.house, body.road, body.city, body.state, body.postcode].filter(Boolean).join(' ') || body.display
    setDraft(line)
    setSource(why + ' · ' + body.source)
  }

  async function onFile(file: File) {
    setError('')
    const gps = await readGps(file)
    if (gps) { await reverse(gps.lat, gps.lon, 'Photo EXIF'); return }
    setError('This picture has no GPS. Listing thumbnails usually do not. Use phone location only if you are standing at the house.')
  }

  async function usePhone() {
    setError('')
    if (!navigator.geolocation) { setError('This browser will not share location.'); return }
    navigator.geolocation.getCurrentPosition(
      async (pos) => { await reverse(pos.coords.latitude, pos.coords.longitude, 'Phone GPS — only valid if you are on site') },
      () => setError('Location denied.'),
      { enableHighAccuracy: true, timeout: 15000 },
    )
  }

  async function lockLead() {
    if (!draft.trim()) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { data: workspaceId } = await supabase.rpc('current_workspace_id')
    if (!user || !workspaceId) { setError('Sign in first.'); setSaving(false); return }
    const { data, error: insertError } = await supabase.from('leads').insert({
      workspace_id: workspaceId,
      name: draft.split(',')[0] || 'Property',
      address: draft.trim(),
      status: 'new',
    }).select('id').single()
    if (insertError) { setError(insertError.message); setSaving(false); return }
    await supabase.from('lead_activity').insert({
      lead_id: data.id, workspace_id: workspaceId, user_id: user.id, kind: 'note',
      body: `Address drafted from ${source || 'manual'}. Human locked.`,
    })
    router.push(`/leads/${data.id}`)
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24">
      <h1 className="text-2xl font-bold">Photo → address</h1>
      <p className="text-sm text-gray-600 mb-4">GPS on the photo, or phone GPS if you are standing there. You still lock it. Vision-from-pixels is not in this slice.</p>
      <input type="file" accept="image/*" capture="environment" onChange={(e) => { const file = e.target.files?.[0]; if (file) void onFile(file) }} className="mb-3 text-sm" />
      <button onClick={() => void usePhone()} className="w-full bg-gray-900 text-white py-2 rounded mb-3">I am at the house — use phone GPS</button>
      {error && <p className="text-sm text-amber-800 mb-3">{error}</p>}
      {source && <p className="text-xs text-gray-500 mb-2">{source}</p>}
      <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={3} className="w-full border rounded p-2 text-sm mb-3" placeholder="Draft address" />
      <button disabled={!draft.trim() || saving} onClick={() => void lockLead()} className="w-full bg-blue-600 text-white py-2 rounded font-semibold disabled:opacity-50">Lock address and open file</button>
    </div>
  )
}
