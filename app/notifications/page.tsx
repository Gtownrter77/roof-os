'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase/client'

type Activity = {
  id: string
  lead_id: string
  kind: 'note' | 'status_change' | 'created'
  body: string
  created_at: string
  leads: { name: string } | null
}

function titleFor(kind: Activity['kind']) {
  if (kind === 'status_change') return 'Lead status changed'
  if (kind === 'created') return 'New lead'
  return 'Lead activity'
}

function iconFor(kind: Activity['kind']) {
  if (kind === 'status_change') return '🔄'
  if (kind === 'created') return '👤'
  return '📝'
}

export default function NotificationsPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    async function loadActivity() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/auth/login')
        return
      }

      const { data, error: queryError } = await supabase
        .from('lead_activity')
        .select('id,lead_id,kind,body,created_at,leads(name)')
        .order('created_at', { ascending: false })
        .limit(50)

      if (!active) return
      if (queryError) setError(queryError.message)
      else setActivities((data ?? []) as unknown as Activity[])
      setLoading(false)
    }

    void loadActivity()
    return () => {
      active = false
    }
  }, [router, supabase])

  const unreadCount = 0

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-blue-600 text-white shadow-lg sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center">
          <button onClick={() => router.back()} className="text-white mr-3 text-xl">←</button>
          <h1 className="text-xl font-bold">🔔 Activity</h1>
          {unreadCount > 0 && (
            <span className="ml-2 bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">{unreadCount}</span>
          )}
        </div>
      </header>

      <main className="p-4">
        <p className="text-sm bg-white rounded-lg shadow p-4 mb-4">
          Live workspace activity. Read/unread state is not persisted because the current activity schema has no read-state field.
        </p>

        <div className="flex justify-between items-center mb-4">
          <p className="text-sm text-gray-500">{activities.length} recent activity items</p>
        </div>

        {loading && <p className="text-sm text-gray-500">Loading activity…</p>}
        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
        {!loading && !error && activities.length === 0 && (
          <p className="text-sm text-gray-500">No saved lead activity is available in this workspace.</p>
        )}

        {activities.map((activity) => (
          <button
            key={activity.id}
            onClick={() => router.push(`/leads/${activity.lead_id}`)}
            className="w-full text-left bg-white rounded-lg shadow p-4 mb-3"
          >
            <div className="flex items-start space-x-3">
              <span className="text-2xl">{iconFor(activity.kind)}</span>
              <div className="flex-1">
                <div className="flex justify-between items-start gap-3">
                  <p className="font-semibold text-sm">{titleFor(activity.kind)}</p>
                  <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                    {activity.kind.replaceAll('_', ' ')}
                  </span>
                </div>
                <p className="text-sm mt-1 text-gray-600">{activity.body}</p>
                <p className="text-xs text-gray-400 mt-2">
                  {activity.leads?.name ?? 'Lead'} · {new Date(activity.created_at).toLocaleString()}
                </p>
              </div>
            </div>
          </button>
        ))}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around py-2 px-4">
        <button onClick={() => router.push('/')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">🏠</span>
          <span className="text-xs">Home</span>
        </button>
        <button onClick={() => router.push('/leads')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">👤</span>
          <span className="text-xs">Leads</span>
        </button>
        <button onClick={() => router.push('/ai')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">🤖</span>
          <span className="text-xs">AI</span>
        </button>
        <button onClick={() => router.push('/notifications')} className="flex flex-col items-center text-blue-600">
          <span className="text-xl">🔔</span>
          <span className="text-xs">Activity</span>
        </button>
        <button onClick={() => router.push('/settings')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">⚙️</span>
          <span className="text-xs">Settings</span>
        </button>
      </nav>
    </div>
  )
}
