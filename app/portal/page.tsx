'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase/client'

type Lead = {
  id: string
  name: string
  phone: string | null
  email: string | null
  status: string
}

type Inspection = {
  id: string
  lead_id: string | null
}

type Customer = Lead & {
  jobs: number
}

export default function PortalPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    async function loadCustomers() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/auth/login')
        return
      }

      const [leadsResult, inspectionsResult] = await Promise.all([
        supabase.from('leads').select('id,name,phone,email,status').order('created_at', { ascending: false }),
        supabase.from('inspection_sessions').select('id,lead_id'),
      ])

      if (!active) return

      if (leadsResult.error) {
        setError(leadsResult.error.message)
        setLoading(false)
        return
      }

      if (inspectionsResult.error) {
        setError(inspectionsResult.error.message)
        setLoading(false)
        return
      }

      const jobCounts = new Map<string, number>()
      for (const inspection of (inspectionsResult.data ?? []) as Inspection[]) {
        if (inspection.lead_id) jobCounts.set(inspection.lead_id, (jobCounts.get(inspection.lead_id) ?? 0) + 1)
      }

      setCustomers(
        ((leadsResult.data ?? []) as Lead[]).map((lead) => ({
          ...lead,
          jobs: jobCounts.get(lead.id) ?? 0,
        })),
      )
      setLoading(false)
    }

    void loadCustomers()
    return () => {
      active = false
    }
  }, [router, supabase])

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-blue-600 text-white shadow-lg sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center">
          <button onClick={() => router.back()} className="text-white mr-3 text-xl">←</button>
          <h1 className="text-xl font-bold">👥 Customers</h1>
        </div>
      </header>

      <main className="p-4">
        <div className="flex justify-between items-center mb-4">
          <p className="text-sm text-gray-500">{customers.length} total customers</p>
          <button
            onClick={() => router.push('/leads/new')}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm"
          >
            + Add Customer
          </button>
        </div>

        {loading && <p className="text-sm text-gray-500">Loading customers…</p>}
        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
        {!loading && !error && customers.length === 0 && (
          <p className="text-sm text-gray-500">No customers are saved in this workspace yet.</p>
        )}

        <div className="space-y-3">
          {customers.map((customer) => {
            const active = !['lost', 'won'].includes(customer.status)
            return (
              <div key={customer.id} className="bg-white rounded-lg shadow p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold">{customer.name}</p>
                    {customer.email && <p className="text-sm text-gray-500">{customer.email}</p>}
                    {customer.phone && <p className="text-sm text-gray-500">{customer.phone}</p>}
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded ${active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                    {customer.status.replaceAll('_', ' ')}
                  </span>
                </div>
                <div className="flex justify-between items-center mt-3">
                  <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded">
                    {customer.jobs} {customer.jobs === 1 ? 'job' : 'jobs'}
                  </span>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => router.push(`/leads/${customer.id}`)}
                      className="text-blue-600 text-xs font-medium"
                    >
                      View
                    </button>
                    {customer.email && (
                      <a href={`mailto:${customer.email}`} className="text-green-600 text-xs font-medium">
                        Message
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around py-2 px-4">
        <button onClick={() => router.push('/')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">🏠</span>
          <span className="text-xs">Home</span>
        </button>
        <button onClick={() => router.push('/portal')} className="flex flex-col items-center text-blue-600">
          <span className="text-xl">👥</span>
          <span className="text-xs">Customers</span>
        </button>
        <button onClick={() => router.push('/ai')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">🤖</span>
          <span className="text-xs">AI</span>
        </button>
        <button onClick={() => router.push('/voice-ai')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">🎤</span>
          <span className="text-xs">Voice</span>
        </button>
        <button onClick={() => router.push('/settings')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">⚙️</span>
          <span className="text-xs">Settings</span>
        </button>
      </nav>
    </div>
  )
}
