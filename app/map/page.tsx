'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase/client'

type Lead = { id: string; name: string; address: string; status: string }
type Alert = { id: string; headline: string; event?: string }

export default function MapPage() {
  const router = useRouter()
  const supabase = createClient()
  const [leads, setLeads] = useState<Lead[]>([])
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('leads').select('id,name,address,status').order('created_at', { ascending: false }).limit(50)
      setLeads(data ?? [])
      try {
        const res = await fetch('https://api.weather.gov/alerts/active?area=GA', { headers: { accept: 'application/geo+json', 'user-agent': 'ROOF-OS/1.0' } })
        const body = await res.json()
        const rows = (body.features ?? []).slice(0, 15).map((feature: any) => ({
          id: feature.id,
          headline: feature.properties?.headline || feature.properties?.event || 'Alert',
          event: feature.properties?.event,
        }))
        setAlerts(rows)
      } catch {
        setError('NWS did not answer. Leads still load.')
      }
    }
    void load()
  }, [supabase])

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24">
      <button onClick={() => router.push('/next10')} className="text-blue-600 text-sm mb-3">Next 10</button>
      <h1 className="text-2xl font-bold">Map desk</h1>
      <p className="text-sm text-gray-600 mb-4">Our files next to official alerts. Not a hail hit list. Tiles come later (Leaflet + OSM).</p>
      {error && <p className="text-sm text-amber-800 mb-3">{error}</p>}
      <h2 className="font-semibold text-sm mb-2">Our properties</h2>
      {leads.map((lead) => (
        <button key={lead.id} onClick={() => router.push(`/leads/${lead.id}`)} className="w-full text-left bg-white rounded-lg shadow p-3 mb-2">
          <p className="font-medium text-sm">{lead.name}</p>
          <p className="text-xs text-gray-500">{lead.address}</p>
        </button>
      ))}
      <h2 className="font-semibold text-sm mt-4 mb-2">NWS candidates (Georgia)</h2>
      {alerts.length === 0 && <p className="text-sm text-gray-500">No active alerts returned.</p>}
      {alerts.map((alert) => (
        <div key={alert.id} className="bg-amber-50 rounded-lg p-3 mb-2 text-sm">{alert.headline}</div>
      ))}
      <p className="text-xs text-gray-400 mt-4">Data: National Weather Service. Attribution required.</p>
    </div>
  )
}
