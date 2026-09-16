'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase/client'

type ActivityRow = {
  id: string
  kind: string
  body: string
  created_at: string
  leads: { name: string } | null
}

const ICONS: Record<string, string> = {
  note: '📝',
  status_change: '📋',
  created: '➕',
}

export default function ActivityPage() {
  const router = useRouter()
  const supabase = createClient()
  const [activities, setActivities] = useState<ActivityRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data, error } = await supabase
        .from('lead_activity')
        .select('id, kind, body, created_at, leads ( name )')
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) setError(error.message)
      else setActivities((data as unknown as ActivityRow[]) || [])
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-blue-600 text-white shadow-lg sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center">
          <button onClick={() => router.back()} className="text-white mr-3 text-xl">←</button>
          <h1 className="text-xl font-bold">📊 Activity Feed</h1>
        </div>
      </header>

      <main className="p-4">
        <p className="text-sm text-gray-500 mb-4">{activities.length} recent activities across your workspace</p>

        {loading && <p className="text-sm text-gray-500">Loading…</p>}
        {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
        {!loading && !error && activities.length === 0 && (
          <div className="bg-white rounded-lg shadow p-6 text-center text-gray-500">
            No activity yet. Notes and status changes on leads will show up here.
          </div>
        )}

        <div className="space-y-3">
          {activities.map((activity) => (
            <div key={activity.id} className="bg-white rounded-lg shadow p-4">
              <div className="flex items-start space-x-3">
                <span className="text-2xl">{ICONS[activity.kind] || '•'}</span>
                <div className="flex-1">
                  <p className="text-sm">
                    <span className="text-blue-600 font-medium">{activity.leads?.name || 'Unknown lead'}</span>
                    {' — '}
                    {activity.body}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">{new Date(activity.created_at).toLocaleString()}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
