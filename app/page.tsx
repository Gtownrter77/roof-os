'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import QuickActions from '../components/QuickActions'
import { createClient } from '../lib/supabase/client'

type Lead = { id: string; name: string; address: string; status: string; created_at: string }

export default function Home() {
  const router = useRouter()
  const supabase = createClient()
  const [recentLeads, setRecentLeads] = useState<Lead[]>([])
  const [counts, setCounts] = useState({ leads: 0, openTasks: 0, upcomingAppointments: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)
      const [leadsRes, recentRes, tasksRes, apptRes] = await Promise.all([
        supabase.from('leads').select('id', { count: 'exact', head: true }),
        supabase.from('leads').select('id,name,address,status,created_at').order('created_at', { ascending: false }).limit(5),
        supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('status', 'open'),
        supabase.from('appointments').select('id', { count: 'exact', head: true }).gte('starts_at', new Date().toISOString()),
      ])
      if (recentRes.error) setError(recentRes.error.message)
      else setRecentLeads(recentRes.data || [])
      setCounts({
        leads: leadsRes.count ?? 0,
        openTasks: tasksRes.count ?? 0,
        upcomingAppointments: apptRes.count ?? 0,
      })
      setLoading(false)
    }
    void load()
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <header className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg sticky top-0 z-10">
        <div className="px-4 py-3">
          <h1 className="text-xl font-bold">ROOF/OS</h1>
          <p className="text-xs opacity-80">Command center</p>
        </div>
      </header>
      <main className="p-4 space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <button onClick={() => router.push('/leads')} className="bg-white rounded-lg shadow p-3 text-center">
            <p className="text-2xl font-bold">{counts.leads}</p>
            <p className="text-xs text-gray-500">Leads</p>
          </button>
          <button onClick={() => router.push('/tasks')} className="bg-white rounded-lg shadow p-3 text-center">
            <p className="text-2xl font-bold">{counts.openTasks}</p>
            <p className="text-xs text-gray-500">Open tasks</p>
          </button>
          <button onClick={() => router.push('/calendar')} className="bg-white rounded-lg shadow p-3 text-center">
            <p className="text-2xl font-bold">{counts.upcomingAppointments}</p>
            <p className="text-xs text-gray-500">Upcoming</p>
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => router.push('/leads/new')} className="bg-blue-600 text-white rounded-lg shadow p-4 font-semibold">+ New lead</button>
          <button onClick={() => router.push('/inspections')} className="bg-white border rounded-lg shadow p-4 font-semibold">Inspections</button>
          <button onClick={() => router.push('/calendar')} className="bg-white border rounded-lg shadow p-4 font-semibold">Schedule</button>
          <button onClick={() => router.push('/tasks')} className="bg-white border rounded-lg shadow p-4 font-semibold">Tasks</button>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-semibold">Recent leads</h2>
            <button onClick={() => router.push('/leads')} className="text-blue-600 text-sm">See all</button>
          </div>
          {loading && <p className="text-sm text-gray-500">Loading…</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}
          {!loading && !error && recentLeads.length === 0 && (
            <p className="text-sm text-gray-500">No leads yet. Add your first one above.</p>
          )}
          {recentLeads.map((lead) => (
            <button key={lead.id} onClick={() => router.push(`/leads/${lead.id}`)} className="w-full flex justify-between items-center py-2 border-b last:border-0 text-left">
              <div>
                <p className="text-sm font-medium">{lead.name}</p>
                <p className="text-xs text-gray-500">{lead.address}</p>
              </div>
              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">{lead.status.replaceAll('_', ' ')}</span>
            </button>
          ))}
        </div>
      </main>
      <QuickActions />
    </div>
  )
}
