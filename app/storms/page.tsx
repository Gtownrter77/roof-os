'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase/client'

type Storm = { id: string; provider: string; event_type: string | null; event_date: string | null; severity: string | null; confidence: string; source_url: string; reviewed: boolean }

export default function StormsPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [rows, setRows] = useState<Storm[]>([])
  const [status, setStatus] = useState('Loading saved storm evidence.')

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { if (!cancelled) setStatus('Sign in required.'); return }
      const { data: workspaceId, error: workspaceError } = await supabase.rpc('current_workspace_id')
      if (workspaceError || !workspaceId) { if (!cancelled) setStatus('No workspace is available.'); return }
      const { data, error } = await supabase.from('storm_evidence').select('id,provider,event_type,event_date,severity,confidence,source_url,reviewed').eq('workspace_id', workspaceId).order('retrieved_at', { ascending: false }).limit(25)
      if (cancelled) return
      if (error) { setStatus(error.message); setRows([]); return }
      setRows(data ?? [])
      setStatus(data && data.length ? 'Saved storm evidence only. A live warning is Unknown.' : 'No saved storm evidence. A live warning is Unknown.')
    }
    load()
    return () => { cancelled = true }
  }, [supabase])

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-blue-600 text-white shadow-lg sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center">
          <button onClick={() => router.back()} className="text-white mr-3 text-xl">Back</button>
          <h1 className="text-xl font-bold">Storm evidence</h1>
        </div>
      </header>
      <main className="p-4 space-y-3">
        <p className="text-sm bg-white rounded-lg shadow p-4">{status}</p>
        {rows.map((row) => (
          <a key={row.id} href={row.source_url} className="block bg-white rounded-lg shadow p-4">
            <p className="font-semibold text-sm">{row.event_type || 'Event type Unknown'}</p>
            <p className="text-xs text-gray-500">{row.provider} · {row.confidence} · {row.reviewed ? 'Reviewed' : 'Not reviewed'}</p>
            <p className="text-xs text-gray-500">{row.event_date || 'Date Unknown'} · {row.severity || 'Severity Unknown'}</p>
          </a>
        ))}
      </main>
    </div>
  )
}
