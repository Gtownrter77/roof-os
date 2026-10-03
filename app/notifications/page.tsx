'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase/client'

type ActivityRow = {
  id: string
  lead_id: string | null
  kind: string
  body: string | null
  created_at: string
}

export default function NotificationsPage() {
  const router = useRouter()
  const supabase = createClient()
  const [rows, setRows] = useState<ActivityRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data, error: queryError } = await supabase
        .from('lead_activity')
        .select('id,lead_id,kind,body,created_at')
        .order('created_at', { ascending: false })
        .limit(50)
      if (cancelled) return
      if (queryError) setError(queryError.message)
      else setRows((data ?? []) as ActivityRow[])
      setLoading(false)
    }
    void load()
    return () => { cancelled = true }
  }, [supabase])

  const kindLabel = (kind: string) => kind.replaceAll('_', ' ')

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-blue-600 text-white shadow-lg sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center">
          <button onClick={() => router.back()} className="text-white mr-3 text-xl">←</button>
          <h1 className="text-xl font-bold">🔔 Notifications</h1>
        </div>
      </header>

      <main className="p-4">
        <p className="text-sm text-gray-600 mb-4">
          Workspace lead activity only. No demo alerts.
        </p>
        {loading && <p className="text-sm text-gray-500">Loading activity…</p>}
        {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
        {!loading && !error && rows.length === 0 && (
          <p className="text-sm text-gray-500">No lead activity recorded yet.</p>
        )}
        <div className="space-y-3">
          {rows.map((row) => (
            <div key={row.id} className="bg-white rounded-lg shadow p-4">
              <p className="text-sm font-medium capitalize">{kindLabel(row.kind)}</p>
              <p className="text-sm text-gray-700 mt-1">{row.body || 'Activity recorded.'}</p>
              <p className="text-xs text-gray-400 mt-1">{new Date(row.created_at).toLocaleString()}</p>
              {row.lead_id && (
                <button
                  type="button"
                  onClick={() => router.push(`/leads/${row.lead_id}`)}
                  className="text-xs text-blue-600 mt-2"
                >
                  Open lead
                </button>
              )}
            </div>
          ))}
        </div>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around py-2 px-4">
        <button onClick={() => router.push('/')} className="text-gray-400 text-sm">🏠 Home</button>
        <button onClick={() => router.push('/notifications')} className="text-blue-600 text-sm">🔔 Alerts</button>
        <button onClick={() => router.push('/leads')} className="text-gray-400 text-sm">👤 Leads</button>
        <button onClick={() => router.push('/activity')} className="text-gray-400 text-sm">📊 Activity</button>
      </nav>
    </div>
  )
}
