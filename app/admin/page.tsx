'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase/client'

type CountState = number | 'Unknown'

type AdminCounts = {
  members: CountState
  leads: CountState
  inspections: CountState
  photos: CountState
}

const emptyCounts: AdminCounts = {
  members: 'Unknown',
  leads: 'Unknown',
  inspections: 'Unknown',
  photos: 'Unknown',
}

export default function AdminPage() {
  const router = useRouter()
  const [status, setStatus] = useState('Checking workspace.')
  const [counts, setCounts] = useState<AdminCounts>(emptyCounts)
  const [signedIn, setSignedIn] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        if (!cancelled) {
          setSignedIn(false)
          setStatus('Sign in required.')
        }
        return
      }
      const { data: workspaceId, error: workspaceError } = await supabase.rpc('current_workspace_id')
      if (workspaceError || !workspaceId) {
        if (!cancelled) {
          setSignedIn(true)
          setStatus('No workspace is available.')
        }
        return
      }
      const [members, leads, inspections, photos] = await Promise.all([
        supabase.from('workspace_members').select('user_id', { count: 'exact', head: true }).eq('workspace_id', workspaceId),
        supabase.from('leads').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId),
        supabase.from('inspection_sessions').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId),
        supabase.from('inspection_photos').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId),
      ])
      if (cancelled) return
      setSignedIn(true)
      setCounts({
        members: members.error ? 'Unknown' : members.count ?? 0,
        leads: leads.error ? 'Unknown' : leads.count ?? 0,
        inspections: inspections.error ? 'Unknown' : inspections.count ?? 0,
        photos: photos.error ? 'Unknown' : photos.count ?? 0,
      })
      setStatus('Counts are this workspace only. Money is Unknown.')
    }
    load()
    return () => { cancelled = true }
  }, [])

  const rows: { label: string; value: CountState }[] = [
    { label: 'Workspace members', value: counts.members },
    { label: 'Leads', value: counts.leads },
    { label: 'Inspection sessions', value: counts.inspections },
    { label: 'Inspection photos', value: counts.photos },
    { label: 'Revenue', value: 'Unknown' },
    { label: 'Storage used', value: 'Unknown' },
  ]

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-blue-600 text-white shadow-lg sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center">
          <button onClick={() => router.back()} className="text-white mr-3 text-xl">Back</button>
          <h1 className="text-xl font-bold">Admin</h1>
        </div>
      </header>
      <main className="p-4 space-y-4">
        <p className="text-sm bg-white rounded-lg shadow p-4">{status}</p>
        {!signedIn && (
          <button onClick={() => router.push('/auth/login')} className="w-full bg-blue-600 text-white py-3 rounded font-semibold">Sign in</button>
        )}
        <div className="grid grid-cols-2 gap-3">
          {rows.map((row) => (
            <div key={row.label} className="bg-white rounded-lg shadow p-4">
              <p className="text-xs text-gray-500">{row.label}</p>
              <p className="text-xl font-bold text-blue-600">{row.value}</p>
            </div>
          ))}
        </div>
        <section className="bg-white rounded-lg shadow p-4">
          <h2 className="font-semibold text-sm mb-2">What this page is not</h2>
          <p className="text-sm">This page does not show server health, a company-wide total, or a price. A missing count stays Unknown.</p>
        </section>
      </main>
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around py-2 px-4">
        <button onClick={() => router.push('/')} className="text-gray-500">Home</button>
        <button onClick={() => router.push('/leads')} className="text-gray-500">Leads</button>
        <button onClick={() => router.push('/settings')} className="text-gray-500">Settings</button>
      </nav>
    </div>
  )
}
