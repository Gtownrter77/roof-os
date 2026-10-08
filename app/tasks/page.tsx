'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase/client'

type Task = { id: string; title: string; status: 'open' | 'completed' | 'dismissed'; due_at: string | null; notes: string | null; lead_id: string | null; priority?: 'critical' | 'high' | 'normal' }
type LeadOption = { id: string; name: string }

export default function TasksPage() {
  const router = useRouter()
  const [tasks, setTasks] = useState<Task[]>([])
  const [leads, setLeads] = useState<LeadOption[]>([])
  const [form, setForm] = useState({ title: '', dueAt: '', leadId: '', notes: '', priority: 'normal' as 'critical' | 'high' | 'normal' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState<'all' | 'overdue' | 'high'>('all')

  const loadTasks = async () => {
    const supabase = createClient()
    setLoading(true)
    const [{ data, error: queryError }, leadRes] = await Promise.all([
      supabase.from('tasks').select('id,title,status,due_at,notes,lead_id,priority').order('due_at', { ascending: true, nullsFirst: false }).limit(100),
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
        supabase.from('tasks').select('id,title,status,due_at,notes,lead_id,priority').order('due_at', { ascending: true, nullsFirst: false }).limit(100),
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
    const { error: insertError } = await supabase.from('tasks').insert({
      workspace_id: workspaceId,
      created_by: user.id,
      assigned_to: user.id,
      title: form.title.trim(),
      notes: form.notes || null,
      priority: form.priority,
      due_at: form.dueAt ? new Date(form.dueAt).toISOString() : null,
      lead_id: form.leadId || null,
      status: 'open'
    })
    if (insertError) setError(insertError.message)
    else { setForm({ title: '', dueAt: '', leadId: '', notes: '', priority: 'normal' }); await loadTasks() }
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

  const isOverdue = (dueAt: string | null, status: string) => {
    if (!dueAt || status === 'completed') return false
    return new Date(dueAt).getTime() < Date.now()
  }

  const filteredTasks = tasks.filter(t => {
    if (filter === 'overdue') return isOverdue(t.due_at, t.status)
    if (filter === 'high') return t.priority === 'critical' || t.priority === 'high'
    return true
  })

  return (
    <main className="ops-bg min-h-screen lg:pl-[232px]">
      <div className="mx-auto max-w-[1180px] p-4 pb-16 md:p-6">
        <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <button onClick={() => router.back()} className="mb-2 text-xs text-cyan-300">← Back</button>
            <p className="ops-label">Owner Priority Engine</p>
            <h1 className="text-3xl font-black text-white">Tasks & Escalations</h1>
            <p className="mt-1 text-sm text-slate-400">Owner exception priority engine with overdue escalation and property jumping.</p>
          </div>
          <div className="glass rounded-lg px-3 py-2 text-xs text-emerald-300">
            {loading ? 'Syncing…' : `${tasks.filter((task) => task.status === 'open').length} open tasks`}
          </div>
        </header>

        <form onSubmit={addTask} className="glass mb-4 space-y-3 rounded-xl p-4">
          <h2 className="font-semibold text-white">Add owner priority task</h2>
          <input
            required
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Order materials / dispatch crew / call adjuster"
            className="w-full rounded-lg border border-white/15 bg-black/25 p-3 text-sm text-white placeholder:text-slate-500"
          />
          <div className="flex flex-col gap-2 md:flex-row">
            <select
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value as any })}
              className="flex-1 rounded-lg border border-white/15 bg-[#0a1427] p-3 text-sm text-white"
            >
              <option value="normal">Normal Priority</option>
              <option value="high">High Urgency</option>
              <option value="critical">🚨 CRITICAL EXCEPTION</option>
            </select>
            <input
              type="datetime-local"
              value={form.dueAt}
              onChange={(e) => setForm({ ...form, dueAt: e.target.value })}
              className="flex-1 rounded-lg border border-white/15 bg-black/25 p-3 text-sm text-white"
            />
            <select
              value={form.leadId}
              onChange={(e) => setForm({ ...form, leadId: e.target.value })}
              className="flex-1 rounded-lg border border-white/15 bg-[#0a1427] p-3 text-sm text-white"
            >
              <option value="">No lead</option>
              {leads.map((lead) => <option key={lead.id} value={lead.id}>{lead.name}</option>)}
            </select>
          </div>
          <button disabled={saving} className="w-full rounded-lg bg-gradient-to-r from-red-600 to-rose-500 py-3 font-semibold text-white disabled:opacity-60">
            {saving ? 'Saving…' : 'Save priority task'}
          </button>
        </form>

        <div className="flex space-x-2 mb-4">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${filter === 'all' ? 'bg-cyan-500 text-black' : 'glass text-slate-300'}`}
          >
            All Tasks ({tasks.length})
          </button>
          <button
            onClick={() => setFilter('overdue')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${filter === 'overdue' ? 'bg-red-500 text-white' : 'glass text-slate-300'}`}
          >
            Overdue Escalations ({tasks.filter(t => isOverdue(t.due_at, t.status)).length})
          </button>
          <button
            onClick={() => setFilter('high')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${filter === 'high' ? 'bg-amber-500 text-black' : 'glass text-slate-300'}`}
          >
            High/Critical Urgency ({tasks.filter(t => t.priority === 'critical' || t.priority === 'high').length})
          </button>
        </div>

        {error && <p className="mb-3 rounded-lg border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-300" role="alert">{error}</p>}

        {loading ? (
          <div className="glass rounded-xl p-5 text-sm text-slate-400">Loading tasks…</div>
        ) : (
          <div className="space-y-3">
            {filteredTasks.map((task) => {
              const overdue = isOverdue(task.due_at, task.status)
              return (
                <article key={task.id} className={`glass flex items-start gap-3 rounded-xl p-4 border-l-4 ${overdue ? 'border-red-500' : task.priority === 'critical' ? 'border-rose-500' : 'border-cyan-500'}`}>
                  <button
                    aria-label={task.status === 'completed' ? 'Reopen task' : 'Complete task'}
                    onClick={() => void toggleTask(task)}
                    className={`mt-1 h-5 w-5 shrink-0 rounded border-2 ${task.status === 'completed' ? 'border-emerald-500 bg-emerald-500' : 'border-slate-500'}`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center space-x-2">
                      <p className={task.status === 'completed' ? 'text-slate-500 line-through font-medium' : 'font-medium text-white'}>{task.title}</p>
                      {overdue && <span className="text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded font-bold uppercase">OVERDUE</span>}
                      {task.priority && <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${task.priority === 'critical' ? 'bg-red-500 text-white' : task.priority === 'high' ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-700 text-slate-300'}`}>{task.priority}</span>}
                    </div>
                    {task.due_at && <p className="mt-1 text-xs text-slate-400">Due {new Date(task.due_at).toLocaleString()}</p>}
                    <div className="mt-2 flex space-x-3 text-xs">
                      {task.lead_id && (
                        <button onClick={() => router.push(`/passport/${task.lead_id}`)} className="text-cyan-300 font-semibold hover:underline">
                          Jump to Property Passport →
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
