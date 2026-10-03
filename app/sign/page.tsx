'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase/client'

type Estimate = { id: string; lead_id: string | null; status: string; created_at: string }

export default function SignPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [rows, setRows] = useState<Estimate[]>([])
  const [estimateId, setEstimateId] = useState('')
  const [name, setName] = useState('')
  const [status, setStatus] = useState('Loading saved estimates.')

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { if (!cancelled) setStatus('Sign in required.'); return }
      const { data: workspaceId, error: workspaceError } = await supabase.rpc('current_workspace_id')
      if (workspaceError || !workspaceId) { if (!cancelled) setStatus('No workspace is available.'); return }
      const { data, error } = await supabase.from('estimates').select('id,lead_id,status,created_at').eq('workspace_id', workspaceId).order('created_at', { ascending: false }).limit(50)
      if (cancelled) return
      if (error) { setStatus(error.message); setRows([]); return }
      setRows(data ?? [])
      setStatus(data && data.length ? 'Saved estimates only. A signature provider is Unknown.' : 'No saved estimates.')
    }
    load()
    return () => { cancelled = true }
  }, [supabase])

  async function saveName() {
    const estimate = rows.find((row) => row.id === estimateId)
    const { data: { user } } = await supabase.auth.getUser()
    const { data: workspaceId } = await supabase.rpc('current_workspace_id')
    if (!user || !workspaceId || !estimate?.lead_id || name.trim().length < 3) {
      setStatus('Choose an estimate linked to a lead and enter a name. This does not execute a contract.')
      return
    }
    const body = `Typed name saved for estimate ${estimate.id}. Name: ${name.trim()}. Signature provider Unknown. Contract was not executed.`
    const { error } = await supabase.from('lead_activity').insert({ lead_id: estimate.lead_id, workspace_id: workspaceId, user_id: user.id, kind: 'note', body })
    setStatus(error ? error.message : 'Name saved on the lead. Contract was not executed.')
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-blue-600 text-white shadow-lg sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center">
          <button onClick={() => router.back()} className="text-white mr-3 text-xl">Back</button>
          <h1 className="text-xl font-bold">Estimates</h1>
        </div>
      </header>
      <main className="p-4 space-y-3">
        <p className="text-sm bg-white rounded-lg shadow p-4">{status}</p>
        {rows.map((row) => (
          <button key={row.id} onClick={() => setEstimateId(row.id)} className="w-full text-left bg-white rounded-lg shadow p-4">
            <p className="font-semibold text-sm">Estimate {row.id.slice(0, 8)}</p>
            <p className="text-xs text-gray-500">{row.status} · {new Date(row.created_at).toLocaleString()}</p>
            <p className="text-xs text-gray-500">{estimateId === row.id ? 'Selected' : 'Not selected'}</p>
          </button>
        ))}
        <label className="block text-sm bg-white rounded-lg shadow p-4">Typed name
          <input value={name} onChange={(event) => setName(event.target.value)} className="mt-1 w-full rounded border p-2" placeholder="Name" />
        </label>
        <button onClick={() => void saveName()} className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold">Save name on lead</button>
        <p className="text-xs text-gray-600">This does not create a signed contract, store an IP address, or claim ESIGN compliance.</p>
      </main>
    </div>
  )
}
