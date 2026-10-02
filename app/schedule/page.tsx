'use client'


import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase/client'

type Appointment = { id: string; title: string; appointment_type: string; starts_at: string; status: string }

export default function SchedulePage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [rows, setRows] = useState<Appointment[]>([])
  const [status, setStatus] = useState('Checking workspace.')

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
      const { data, error } = await supabase.from('appointments').select('id,title,appointment_type,starts_at,status').eq('workspace_id', workspaceId).order('starts_at', { ascending: true })
      if (cancelled) return
      if (error) {
        setStatus(error.message)
        setRows([])
        return
      }
      setRows(data ?? [])
      setStatus(data && data.length ? 'These are saved appointments for this workspace.' : 'No saved appointments. Report schedules are Unknown.')
    }
    load()
    return () => { cancelled = true }
  }, [supabase])

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-blue-600 text-white shadow-lg sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center">
          <button onClick={() => router.back()} className="text-white mr-3 text-xl">Back</button>
          <h1 className="text-xl font-bold">Schedule</h1>
        </div>
      </header>
      <main className="p-4 space-y-3">
        <p className="text-sm bg-white rounded-lg shadow p-4">{status}</p>
        <button onClick={() => router.push('/calendar')} className="w-full bg-blue-600 text-white py-3 rounded font-semibold">Open calendar</button>
        {rows.map((row) => (
          <div key={row.id} className="bg-white rounded-lg shadow p-4">
            <p className="font-semibold text-sm">{row.title || 'Unknown'}</p>
            <p className="text-xs text-gray-500">{row.appointment_type || 'Unknown'} · {row.starts_at ? new Date(row.starts_at).toLocaleString() : 'Unknown'}</p>
            <p className="text-xs text-gray-500">{row.status || 'Unknown'}</p>
          </div>
        ))}
      </main>
    </div>
  )
}
