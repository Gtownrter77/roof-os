'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase/client'

type Snapshot = { id: string; query: string; zipcode: string | null; source_url: string; retrieved_at: string }

export default function HomeDepotPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [rows, setRows] = useState<Snapshot[]>([])
  const [status, setStatus] = useState('Checking saved Home Depot snapshots.')

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { if (!cancelled) setStatus('Sign in required.'); return }
      const { data: workspaceId, error: workspaceError } = await supabase.rpc('current_workspace_id')
      if (workspaceError || !workspaceId) { if (!cancelled) setStatus('No workspace is available.'); return }
      const { data, error } = await supabase.from('retailer_price_snapshots').select('id,query,zipcode,source_url,retrieved_at').eq('workspace_id', workspaceId).eq('provider', 'home_depot').order('retrieved_at', { ascending: false }).limit(25)
      if (cancelled) return
      if (error) { setStatus(error.message); setRows([]); return }
      setRows(data ?? [])
      setStatus(data && data.length ? 'Saved snapshots only. A current price is Unknown until you approve it.' : 'No saved Home Depot snapshots. Live inventory is Unknown.')
    }
    load()
    return () => { cancelled = true }
  }, [supabase])

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-blue-600 text-white shadow-lg sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center">
          <button onClick={() => router.back()} className="text-white mr-3 text-xl">Back</button>
          <h1 className="text-xl font-bold">Home Depot snapshots</h1>
        </div>
      </header>
      <main className="p-4 space-y-3">
        <p className="text-sm bg-white rounded-lg shadow p-4">{status}</p>
        {rows.map((row) => (
          <a key={row.id} href={row.source_url} className="block bg-white rounded-lg shadow p-4">
            <p className="font-semibold text-sm">{row.query}</p>
            <p className="text-xs text-gray-500">{row.zipcode || 'ZIP Unknown'} · {new Date(row.retrieved_at).toLocaleString()}</p>
            <p className="text-xs text-gray-500">Price Unknown</p>
          </a>
        ))}
      </main>
    </div>
  )
}
