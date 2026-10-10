'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase/client'

type CountState = number | 'Unknown'

export default function AnalyticsPage() {
  const router = useRouter()
  const [status, setStatus] = useState('Checking workspace.')
  const [leads, setLeads] = useState<CountState>('Unknown')
  const [inspections, setInspections] = useState<CountState>('Unknown')
  const [photos, setPhotos] = useState<CountState>('Unknown')

  useEffect(() => {
    let cancelled = false
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        if (!cancelled) setStatus('Sign in required. Rates stay Unknown.')
        return
      }
      const { data: workspaceId, error } = await supabase.rpc('current_workspace_id')
      if (error || !workspaceId) {
        if (!cancelled) setStatus('No workspace is available. Rates stay Unknown.')
        return
      }
      const [leadRows, inspectionRows, photoRows] = await Promise.all([
        supabase.from('leads').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId),
        supabase.from('inspection_sessions').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId),
        supabase.from('inspection_photos').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId),
      ])
      if (cancelled) return
      setLeads(leadRows.error ? 'Unknown' : leadRows.count ?? 0)
      setInspections(inspectionRows.error ? 'Unknown' : inspectionRows.count ?? 0)
      setPhotos(photoRows.error ? 'Unknown' : photoRows.count ?? 0)
      setStatus('Counts are this workspace only. Rates and revenue stay Unknown.')
    }
    load()
    return () => { cancelled = true }
  }, [])

  const rows = [
    { label: 'Leads', value: leads },
    { label: 'Inspection sessions', value: inspections },
    { label: 'Inspection photos', value: photos },
    { label: 'Conversion rate', value: 'Unknown' },
    { label: 'Average response time', value: 'Unknown' },
    { label: 'Revenue', value: 'Unknown' },
  ]

  return (
    <div className="space-y-4 pb-4">
      <header className="glass sticky top-0 z-10 rounded-xl mb-4">
        <div className="px-4 py-3 flex items-center">
          <button onClick={() => router.back()} className="mr-3 text-xl text-cyan-300">Back</button>
          <h1 className="text-xl font-bold">Analytics</h1>
        </div>
      </header>
      <main className="p-4 space-y-4">
        <p className="text-sm glass rounded-xl p-4">{status}</p>
        <div className="grid grid-cols-2 gap-3">
          {rows.map((row) => (
            <div key={row.label} className="glass rounded-xl p-4">
              <p className="text-xs text-slate-400">{row.label}</p>
              <p className="text-xl font-bold text-cyan-300">{row.value}</p>
            </div>
          ))}
        </div>
      </main>
      <nav className="fixed bottom-0 left-0 right-0 z-30 flex justify-around border-t border-white/10 bg-[#070b14]/95 py-2 px-4 backdrop-blur lg:hidden">
        <button onClick={() => router.push('/')} className="text-slate-400">Home</button>
        <button onClick={() => router.push('/leads')} className="text-slate-400">Leads</button>
        <button onClick={() => router.push('/settings')} className="text-slate-400">Settings</button>
      </nav>
    </div>
  )
}
