'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase/client'

type Activity = { id: string; lead_id: string | null; kind: string | null; body: string | null; created_at: string | null }

export default function NotificationsPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [rows, setRows] = useState<Activity[]>([])
  const [status, setStatus] = useState('Checking workspace activity.')

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        if (!cancelled) setStatus('Sign in required.')
        return
      }
      const { data: workspaceId, error: workspaceError } = await supabase.rpc('current_workspace_id')
      if (workspaceError || !workspaceId) {
        if (!cancelled) setStatus('No workspace is available.')
        return
      }
      const { data, error } = await supabase.from('lead_activity').select('id,lead_id,kind,body,created_at').eq('workspace_id', workspaceId).order('created_at', { ascending: false }).limit(50)
      if (cancelled) return
      if (error) {
        setStatus(error.message)
        setRows([])
        return
      }
      setRows(data ?? [])
      setStatus(data && data.length ? 'These are saved lead activity records for this workspace.' : 'No saved activity. Weather and SLA alerts are Unknown.')
    }
    load()
    return () => { cancelled = true }
  }, [supabase])

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-blue-600 text-white shadow-lg sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center">
          <button onClick={() => router.back()} className="text-white mr-3 text-xl">Back</button>
          <h1 className="text-xl font-bold">Notifications</h1>
        </div>
      </header>
      <main className="p-4 space-y-3">
        <p className="text-sm bg-white rounded-lg shadow p-4">{status}</p>
        {rows.map((row) => (
          <button key={row.id} onClick={() => row.lead_id && router.push(`/leads/${row.lead_id}`)} className="w-full text-left bg-white rounded-lg shadow p-4">
            <p className="font-semibold text-sm">{row.kind || 'Unknown'}</p>
            <p className="text-sm text-gray-600">{row.body || 'Unknown'}</p>
            <p className="text-xs text-gray-400">{row.created_at ? new Date(row.created_at).toLocaleString() : 'Unknown'}</p>
          </button>
        ))}
      </main>
    </div>
  )
}
