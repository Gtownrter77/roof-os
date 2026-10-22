'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { smartBack } from '../../lib/smart-back'
import { createClient } from '../../lib/supabase/client'

type Task = { id: string; title: string; status: 'open' | 'completed' | 'dismissed'; due_at: string | null; notes: string | null; lead_id: string | null }
type LeadOption = { id: string; name: string }

export default function TasksPage() {
  const router = useRouter()
  const [tasks, setTasks] = useState<Task[]>([])
  const [leads, setLeads] = useState<LeadOption[]>([])
  const [form, setForm] = useState({ title: '', dueAt: '', leadId: '', notes: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const loadTasks = async () => {
    const supabase = createClient()
    setLoading(true)
    const [{ data, error: queryError }, leadRes] = await Promise.all([
      supabase.from('tasks').select('id,title,status,due_at,notes,lead_id').order('due_at', { ascending: true, nullsFirst: false }).limit(100),
      supabase.from('leads').select('id,name').order('created_at', { ascending: false }).limit(100),
    ])
    if (queryError) {
      setError(queryError.message)
    } else {
      setTasks((data ?? []) as Task[])
    }
    if (leadRes.error) setError(leadRes.error.message)
    else setLeads(leadRes.data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    let cancelled = false

    async function load() {
      const supabase = createClient()
      setLoading(true)
      const [{ data, error: queryError }, leadRes] = await Promise.all([
        supabase.from('tasks').select('id,title,status,due_at,notes,lead_id').order('due_at', { ascending: true, nullsFirst: false }).limit(100),
        supabase.from('leads').select('id,name').order('created_at', { ascending: false }).limit(100),
      ])
      if (cancelled) return
      if (queryError) setError(queryError.message)
      else setTasks((data ?? []) as Task[])
      if (leadRes.error) setError(leadRes.error.message)
      else setLeads(leadRes.data ?? [])
      setLoading(false)
    }

    void load()
    return () => { cancelled = true }
  }, [])

  const addTask = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!form.title.trim()) return
    const supabase = createClient()
    setSaving(true); setError('')
    const { data: { user } } = await supabase.auth.getUser()
    const { data: workspaceId } = await supabase.rpc('current_workspace_id')
    if (!user || !workspaceId) { setError('No workspace is available.'); setSaving(false); return }
    const { error: insertError } = await supabase.from('tasks').insert({ workspace_id: workspaceId, created_by: user.id, assigned_to: user.id, title: form.title.trim(), notes: form.notes || null, due_at: form.dueAt ? new Date(form.dueAt).toISOString() : null, lead_id: form.leadId || null, status: 'open' })
    if (insertError) setError(insertError.message)
    else { setForm({ title: '', dueAt: '', leadId: '', notes: '' }); await loadTasks() }
    setSaving(false)
  }

  const toggleTask = async (task: Task) => {
    const supabase = createClient()
    const nextStatus = task.status === 'completed' ? 'open' : 'completed'
    const { data: workspaceId } = await supabase.rpc('current_workspace_id')
    if (!workspaceId) {
      setError('No workspace is available.')
      return
    }
    const { error: updateError } = await supabase
      .from('tasks')
      .update({ status: nextStatus, updated_at: new Date().toISOString() })
      .eq('id', task.id)
      .eq('workspace_id', workspaceId)
    if (updateError) setError(updateError.message)
    else setTasks((current) => current.map((item) => item.id === task.id ? { ...item, status: nextStatus } : item))
  }

  return <main className="space-y-4"><div className="mx-auto max-w-[1180px] p-4 pb-16 md:p-6"><header className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><button onClick={() => smartBack(router)} className="mb-2 text-xs text-cyan-300">← Back</button><p className="ops-label">Production control</p><h1 className="text-3xl font-black">Tasks</h1><p className="mt-1 text-sm text-slate-400">Keep the active job pipeline moving with clear owners and due dates.</p></div><div className="glass rounded-lg px-3 py-2 text-xs text-emerald-300">{loading ? 'Syncing…' : `${tasks.filter((task) => task.status === 'open').length} open tasks`}</div></header><form onSubmit={addTask} className="glass mb-4 space-y-3 rounded-xl p-4"><h2 className="font-semibold">Add production task</h2><input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Call customer / order materials" className="w-full rounded-lg border border-white/15 bg-black/25 p-3 text-sm text-white placeholder:text-slate-500"/><div className="flex flex-col gap-2 md:flex-row"><input type="datetime-local" value={form.dueAt} onChange={(e) => setForm({ ...form, dueAt: e.target.value })} className="flex-1 rounded-lg border border-white/15 bg-black/25 p-3 text-sm text-white"/><select value={form.leadId} onChange={(e) => setForm({ ...form, leadId: e.target.value })} className="flex-1 rounded-lg border border-white/15 bg-[#0a1427] p-3 text-sm text-white"><option value="">No lead</option>{leads.map((lead) => <option key={lead.id} value={lead.id}>{lead.name}</option>)}</select></div><button disabled={saving} className="w-full rounded-lg bg-gradient-to-r from-red-600 to-rose-500 py-3 font-semibold text-white disabled:opacity-60">{saving ? 'Saving…' : 'Save task'}</button></form>{error && <p className="mb-3 rounded-lg border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-300" role="alert">{error}</p>}{loading ? <div className="glass rounded-xl p-5 text-sm text-slate-400">Loading tasks…</div> : <div className="space-y-3">{tasks.map((task) => <article key={task.id} className="glass flex gap-3 rounded-xl p-4"><button aria-label={task.status === 'completed' ? 'Reopen task' : 'Complete task'} onClick={() => void toggleTask(task)} className={`mt-1 h-5 w-5 shrink-0 rounded border-2 ${task.status === 'completed' ? 'border-emerald-500 bg-emerald-500' : 'border-slate-500'}`}/><div className="min-w-0"><p className={task.status === 'completed' ? 'text-slate-500 line-through' : 'font-medium text-white'}>{task.title}</p>{task.due_at && <p className="mt-1 text-xs text-slate-400">Due {new Date(task.due_at).toLocaleString()}</p>}{task.lead_id && <button onClick={() => router.push(`/leads/${task.lead_id}`)} className="mt-2 text-xs text-cyan-300">Open lead</button>}</div></article>)}</div>}</div></main>
}
