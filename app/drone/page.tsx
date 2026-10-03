'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase/client'

type Capture = { id: string; source_type: string; asset_url: string; captured_at: string | null; confidence: string; notes: string | null }

export default function DronePage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [rows, setRows] = useState<Capture[]>([])
  const [status, setStatus] = useState('Loading saved captures.')

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { if (!cancelled) setStatus('Sign in required.'); return }
      const { data: workspaceId, error: workspaceError } = await supabase.rpc('current_workspace_id')
      if (workspaceError || !workspaceId) { if (!cancelled) setStatus('No workspace is available.'); return }
      const { data, error } = await supabase.from('drone_captures').select('id,source_type,asset_url,captured_at,confidence,notes').eq('workspace_id', workspaceId).order('created_at', { ascending: false }).limit(25)
      if (cancelled) return
      if (error) { setStatus(error.message); setRows([]); return }
      setRows(data ?? [])
      setStatus(data && data.length ? 'Saved capture records only. A live drone is not connected.' : 'No saved captures. A live drone is not connected.')
    }
    load()
    return () => { cancelled = true }
  }, [supabase])

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-blue-600 text-white shadow-lg sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center">
          <button onClick={() => router.back()} className="text-white mr-3 text-xl">Back</button>
          <h1 className="text-xl font-bold">Drone captures</h1>
        </div>
      </header>
      <main className="p-4 space-y-3">
        <p className="text-sm bg-white rounded-lg shadow p-4">{status}</p>
        {rows.map((row) => (
          <a key={row.id} href={row.asset_url} className="block bg-white rounded-lg shadow p-4">
            <p className="font-semibold text-sm">{row.source_type}</p>
            <p className="text-xs text-gray-500">{row.confidence} · {row.captured_at ? new Date(row.captured_at).toLocaleString() : 'Time Unknown'}</p>
            <p className="text-xs text-gray-500">{row.notes || 'No notes'}</p>
          </a>
        ))}
      </main>
    </div>
  )
}
