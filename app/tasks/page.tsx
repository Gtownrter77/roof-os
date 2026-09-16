'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase/client'

type Task = { id: string; title: string; status: 'open' | 'completed' | 'dismissed'; due_at: string | null; notes: string | null; lead_id: string | null }
type LeadOption = { id: string; name: string }

export default function TasksPage() {
  const router = useRouter()
  const supabase = createClient()
  const [tasks, setTasks] = useState<Task[]>([])
  const [leads, setLeads] = useState<LeadOption[]>([])
  const [form, setForm] = useState({ title: '', dueAt: '', leadId: '', notes: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const loadTasks = async () => {
    setLoading(true)
    const [{ data, error: queryError }, leadRes] = await Promise.all([
      supabase.from('tasks').select('id,title,status,due_at,notes,lead_id').order('due_at', { ascending: true, nullsFirst: false }).limit(100),
      supabase.from('leads').select('id,name').order('created_at', { ascending: false }).limit(100),
    ])
    if (queryError) setError(queryError.message)
    else setTasks((data ?? []) as Task[])
    setLeads(leadRes.data ?? [])
    setLoading(false)
  }

  useEffect(() => { void loadTasks() }, [])

  const toggleTask = async (task: Task) => {
    const nextStatus = task.status === 'completed' ? 'open' : 'completed'
    const { error: updateError } = await supabase.from('tasks').update({ status: nextStatus, updated_at: new Date().toISOString() }).eq('id', task.id)
    if (updateError) setError(updateError.message)
    else setTasks(tasks.map((item) => item.id === task.id ? { ...item, status: nextStatus } : item))
  }

  const addTask = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!form.title.trim()) return
    setSaving(true); setError('')
    const { data: { user } } = await supabase.auth.getUser()
    const { data: workspaceId } = await supabase.rpc('current_workspace_id')
    if (!user || !workspaceId) { setError('No workspace is available for this account.'); setSaving(false); return }
    const { error: insertError } = await supabase.from('tasks').insert({
      workspace_id: workspaceId,
      created_by: user.id,
      assigned_to: user.id,
      title: form.title.trim(),
      notes: form.notes || null,
      due_at: form.dueAt ? new Date(form.dueAt).toISOString() : null,
      lead_id: form.leadId || null,
      status: 'open',
    })
    if (insertError) setError(insertError.message)
    else {
      setForm({ title: '', dueAt: '', leadId: '', notes: '' })
      await loadTasks()
    }
    setSaving(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <header className="bg-blue-600 text-white shadow-lg sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center">
          <button onClick={() => router.back()} className="text-white mr-3 text-xl">←</button>
          <h1 className="text-xl font-bold">Tasks</h1>
          <span className="ml-2 bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">{tasks.filter((t) => t.status !== 'completed').length}</span>
        </div>
      </header>
      <main className="p-4">
        <form onSubmit={addTask} className="bg-white rounded-lg shadow p-4 mb-4 space-y-2">
          <h2 className="font-semibold">Add task</h2>
          <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Call customer / order materials" className="w-full p-2 border rounded text-sm" />
          <div className="flex gap-2">
            <input type="datetime-local" value={form.dueAt} onChange={(e) => setForm({ ...form, dueAt: e.target.value })} className="flex-1 p-2 border rounded text-sm" />
            <select value={form.leadId} onChange={(e) => setForm({ ...form, leadId: e.target.value })} className="flex-1 p-2 border rounded text-sm">
              <option value="">No lead</option>
              {leads.map((lead) => <option key={lead.id} value={lead.id}>{lead.name}</option>)}
            </select>
          </div>
          <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Notes" className="w-full p-2 border rounded text-sm" />
          <button disabled={saving} className="w-full bg-blue-600 text-white py-2 rounded font-semibold disabled:opacity-60">{saving ? 'Saving…' : 'Save task'}</button>
        </form>
        {error && <p className="text-sm text-red-600 mb-3" role="alert">{error}</p>}
        {loading ? <p className="text-sm text-gray-500">Loading tasks…</p> : tasks.length === 0 ? <p className="text-sm text-gray-500">No tasks yet.</p> : tasks.map((task) => (
          <div key={task.id} className="bg-white rounded-lg shadow p-4 mb-3">
            <div className="flex items-start space-x-3">
              <button onClick={() => void toggleTask(task)} className={`mt-1 w-5 h-5 rounded border-2 flex items-center justify-center ${task.status === 'completed' ? 'bg-green-500 border-green-500' : 'border-gray-300'}`}>{task.status === 'completed' && '✓'}</button>
              <div className="flex-1">
                <p className={`font-medium ${task.status === 'completed' ? 'line-through text-gray-400' : ''}`}>{task.title}</p>
                {task.lead_id && <button onClick={() => router.push(`/leads/${task.lead_id}`)} className="text-xs text-blue-600 mt-2">Open lead</button>}
              </div>
            </div>
          </div>
        ))}
      </main>
    </div>
  )
}
