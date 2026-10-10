'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { smartBack } from '../../lib/smart-back'
import { createClient } from '../../lib/supabase/client'

type Activity = {
  id: string
  lead_id: string | null
  kind: string
  body: string
  created_at: string
}

export default function ActivityPage() {
  const router = useRouter()
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      const supabase = createClient()
      const { data, error: queryError } = await supabase
        .from('lead_activity')
        .select('id,lead_id,kind,body,created_at')
        .order('created_at', { ascending: false })
        .limit(50)

      if (cancelled) return
      if (queryError) {
        setError(queryError.message)
      } else {
        setActivities((data ?? []) as Activity[])
      }
      setLoading(false)
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="space-y-4 pb-4">
      <header className="glass rounded-xl mb-4">
        <div className="px-4 py-3 flex items-center">
          <button type="button" onClick={() => smartBack(router)} className="mr-3 text-xl text-cyan-300" aria-label="Go back">←</button>
          <h1 className="text-xl font-bold">📊 Activity Feed</h1>
        </div>
      </header>

      <main className="p-4">
        <div className="flex justify-between items-center mb-4">
          <p className="text-sm text-slate-400">{activities.length} recent activities</p>
          <span className="text-xs text-slate-400">Workspace activity</span>
        </div>

        <div className="space-y-3">
          {loading && <p className="text-sm text-slate-400">Loading workspace activity…</p>}
          {error && <p className="text-sm text-red-300">{error}</p>}
          {!loading && !error && activities.length === 0 && <p className="text-sm text-slate-400">No lead activity recorded yet.</p>}
          {activities.map((activity) => (
            <div key={activity.id} className="glass rounded-xl p-4">
              <p className="text-sm font-medium">{activity.kind.replaceAll('_', ' ')}</p>
              <p className="text-sm text-slate-200 mt-1">{activity.body || 'Activity recorded.'}</p>
              <p className="text-xs text-slate-400 mt-1">{new Date(activity.created_at).toLocaleString()}</p>
              {activity.lead_id && (
                <button type="button" onClick={() => router.push('/leads/' + activity.lead_id)} className="text-xs text-cyan-300 mt-2">
                  Open lead
                </button>
              )}
            </div>
          ))}
        </div>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-30 flex justify-around border-t border-white/10 bg-[#070b14]/95 py-2 px-4 backdrop-blur lg:hidden">
        <button type="button" onClick={() => router.push('/')} className="flex flex-col items-center text-slate-400">
          <span className="text-xl">🏠</span>
          <span className="text-xs">Home</span>
        </button>
        <button type="button" onClick={() => router.push('/activity')} className="flex flex-col items-center text-cyan-300">
          <span className="text-xl">📊</span>
          <span className="text-xs">Activity</span>
        </button>
        <button type="button" onClick={() => router.push('/ai')} className="flex flex-col items-center text-slate-400">
          <span className="text-xl">🤖</span>
          <span className="text-xs">AI</span>
        </button>
        <button type="button" onClick={() => router.push('/notifications')} className="flex flex-col items-center text-slate-400">
          <span className="text-xl">🔔</span>
          <span className="text-xs">Alerts</span>
        </button>
        <button type="button" onClick={() => router.push('/settings')} className="flex flex-col items-center text-slate-400">
          <span className="text-xl">⚙️</span>
          <span className="text-xs">Settings</span>
        </button>
      </nav>
    </div>
  )
}
