'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase/client'

export default function ActivityPage() {
  const router = useRouter()
  const supabase = createClient()
  const [activities, setActivities] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setError('Sign in required.'); setActivities([]); setLoading(false); return }
      const { data: workspaceId, error: workspaceError } = await supabase.rpc('current_workspace_id')
      if (workspaceError || !workspaceId) { setError('No workspace is available.'); setActivities([]); setLoading(false); return }
      const { data, error: queryError } = await supabase.from('lead_activity').select('id,lead_id,kind,body,created_at').eq('workspace_id', workspaceId).order('created_at', { ascending: false }).limit(50)
      if (queryError) setError(queryError.message)
      else setActivities(data ?? [])
      setLoading(false)
    }
    void load()
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
        <div className="flex justify-between items-center mb-4">
          <p className="text-sm text-gray-500">{activities.length} recent activities</p>
          <span className="text-xs text-gray-500">Workspace activity</span>
        </div>

        <div className="space-y-3">
          {loading && <p className="text-sm text-gray-500">Loading workspace activity…</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}
          {!loading && !error && activities.length === 0 && <p className="text-sm text-gray-500">No lead activity recorded yet.</p>}
          {activities.map((activity) => (
            <div key={activity.id} className="bg-white rounded-lg shadow p-4">
              <p className="text-sm font-medium">{activity.kind.replaceAll('_', ' ')}</p>
              <p className="text-sm text-gray-700 mt-1">{activity.body || 'Activity recorded.'}</p>
              <p className="text-xs text-gray-400 mt-1">{new Date(activity.created_at).toLocaleString()}</p>
              <button onClick={() => router.push('/leads/' + activity.lead_id)} className="text-xs text-blue-600 mt-2">Open lead</button>
            </div>
          ))}
        </div>     </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around py-2 px-4">
        <button onClick={() => router.push('/')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">🏠</span>
          <span className="text-xs">Home</span>
        </button>
        <button onClick={() => router.push('/activity')} className="flex flex-col items-center text-blue-600">
          <span className="text-xl">📊</span>
          <span className="text-xs">Activity</span>
        </button>
        <button onClick={() => router.push('/ai')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">🤖</span>
          <span className="text-xs">AI</span>
        </button>
        <button onClick={() => router.push('/notifications')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">🔔</span>
          <span className="text-xs">Alerts</span>
        </button>
        <button onClick={() => router.push('/settings')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">⚙️</span>
          <span className="text-xs">Settings</span>
        </button>
      </nav>
    </div>
  )
}
