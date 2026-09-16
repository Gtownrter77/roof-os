'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase/client'

type Task = { id: string; title: string; status: 'open' | 'completed' | 'dismissed'; due_at: string | null; notes: string | null }

export default function TasksPage() {
  const router = useRouter()
  const supabase = createClient()
  const [tasks, setTasks] = useState<Task[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const loadTasks = async () => {
    setLoading(true)
    const { data, error: queryError } = await supabase.from('tasks').select('id,title,status,due_at,notes').order('due_at', { ascending: true, nullsFirst: false }).limit(100)
    if (queryError) setError(queryError.message)
    else setTasks((data ?? []) as Task[])
    setLoading(false)
  }

  useEffect(() => { void loadTasks() }, [])

  const toggleTask = async (task: Task) => {
    const nextStatus = task.status === 'completed' ? 'open' : 'completed'
    const { error: updateError } = await supabase.from('tasks').update({ status: nextStatus, updated_at: new Date().toISOString() }).eq('id', task.id)
    if (updateError) setError(updateError.message)
    else setTasks(tasks.map((item) => item.id === task.id ? { ...item, status: nextStatus } : item))
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-blue-600 text-white shadow-lg sticky top-0 z-10"><div className="px-4 py-3 flex items-center"><button onClick={() => router.back()} className="text-white mr-3 text-xl">←</button><h1 className="text-xl font-bold">✅ Tasks</h1><span className="ml-2 bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">{tasks.filter((t) => t.status !== 'completed').length}</span></div></header>
      <main className="p-4">
        <div className="flex justify-between items-center mb-4"><p className="text-sm text-gray-500">Persisted workspace follow-ups</p><button onClick={() => void loadTasks()} className="text-blue-600 text-sm">Refresh</button></div>
        {error && <p className="text-sm text-red-600 mb-3" role="alert">Could not load tasks: {error}</p>}
        {loading ? <p className="text-sm text-gray-500">Loading tasks…</p> : tasks.length === 0 ? <p className="text-sm text-gray-500">No tasks yet. New leads and qualified statuses create automated follow-ups.</p> : tasks.map((task) => <div key={task.id} className="bg-white rounded-lg shadow p-4 mb-3"><div className="flex items-start space-x-3"><button onClick={() => void toggleTask(task)} className={`mt-1 w-5 h-5 rounded border-2 flex items-center justify-center ${task.status === 'completed' ? 'bg-green-500 border-green-500' : 'border-gray-300'}`}>{task.status === 'completed' && '✓'}</button><div className="flex-1"><p className={`font-medium ${task.status === 'completed' ? 'line-through text-gray-400' : ''}`}>{task.title}</p><div className="flex justify-between mt-2"><span className="text-xs text-gray-500">{task.status}</span><span className="text-xs text-gray-400">{task.due_at ? new Date(task.due_at).toLocaleString() : 'No due date'}</span></div>{task.notes && <p className="text-xs text-gray-400 mt-2">{task.notes}</p>}</div></div></div>)}
      </main>
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around py-2 px-4"><button onClick={() => router.push('/')} className="text-gray-400">🏠 Home</button><button onClick={() => router.push('/tasks')} className="text-blue-600">✅ Tasks</button><button onClick={() => router.push('/settings')} className="text-gray-400">⚙️ Settings</button></nav>
    </div>
  )
}
