'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase/client'

type Photo = { id: string; album: string | null; caption: string | null; created_at: string | null }

const required = ['north', 'south', 'east', 'west', 'roof-top', 'closeup-damage']

export default function PhotoVerifyPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [rows, setRows] = useState<Photo[]>([])
  const [status, setStatus] = useState('Checking saved inspection photos.')

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { if (!cancelled) setStatus('Sign in required.'); return }
      const { data: workspaceId, error: workspaceError } = await supabase.rpc('current_workspace_id')
      if (workspaceError || !workspaceId) { if (!cancelled) setStatus('No workspace is available.'); return }
      const { data, error } = await supabase.from('inspection_photos').select('id,album,caption,created_at').eq('workspace_id', workspaceId).order('created_at', { ascending: false }).limit(50)
      if (cancelled) return
      if (error) { setStatus(error.message); setRows([]); return }
      setRows(data ?? [])
      const albums = new Set((data ?? []).map((row) => row.album))
      const missing = required.filter((item) => !albums.has(item))
      setStatus(data && data.length ? `Saved photos: ${data.length}. Missing album labels: ${missing.join(', ') || 'none'}.` : 'No saved inspection photos. Coverage is Unknown.')
    }
    load()
    return () => { cancelled = true }
  }, [supabase])

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-blue-600 text-white shadow-lg sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center">
          <button onClick={() => router.back()} className="text-white mr-3">Back</button>
          <h1 className="text-xl font-bold">Photo check</h1>
        </div>
      </header>
      <main className="p-4 space-y-3">
        <p className="text-sm bg-white rounded-lg shadow p-4">{status}</p>
        {rows.map((row) => (
          <div key={row.id} className="bg-white rounded-lg shadow p-4">
            <p className="font-semibold text-sm">{row.album || 'Unknown'}</p>
            <p className="text-xs text-gray-500">{row.caption || 'No caption'} · {row.created_at ? new Date(row.created_at).toLocaleString() : 'Unknown'}</p>
          </div>
        ))}
      </main>
    </div>
  )
}
