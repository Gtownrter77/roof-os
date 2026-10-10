'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase/client'

type Item = { title: string; why: string; href: string }

export default function BriefPage() {
  const router = useRouter()
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      const supabase = createClient()
      const now = new Date().toISOString()
      const [{ data: cold, error: coldError }, { data: tasks, error: tasksError }, { data: warranties, error: warrantiesError }, { data: sessions, error: sessionsError }] = await Promise.all([
        supabase.from('leads').select('id,name,status,created_at').in('status', ['new', 'qualified', 'report_pending']).order('created_at', { ascending: true }).limit(20),
        supabase.from('tasks').select('id,title,due_at,lead_id,status').eq('status', 'open').limit(20),
        supabase.from('warranties').select('id,manufacturer,registration_status,lead_id,missing_items').in('registration_status', ['not_started', 'packet_ready']).limit(20),
        supabase.from('inspection_sessions').select('id,lead_id,status').eq('status', 'in_progress').limit(20),
      ])
      if (cancelled) return
      const firstError = coldError ?? tasksError ?? warrantiesError ?? sessionsError
      if (firstError) {
        setError(firstError.message)
        setLoading(false)
        return
      }
      const next: Item[] = []
      ;(cold ?? []).forEach((lead) => next.push({ title: `Move ${lead.name}`, why: `Stuck in ${lead.status.replaceAll('_', ' ')}`, href: `/leads/${lead.id}` }))
      ;(tasks ?? []).filter((task) => task.due_at && task.due_at < now).forEach((task) => next.push({ title: task.title, why: 'Overdue follow-up', href: task.lead_id ? `/leads/${task.lead_id}` : '/tasks' }))
      ;(warranties ?? []).forEach((row) => next.push({ title: `${row.manufacturer} warranty`, why: row.missing_items || 'Registration not complete', href: '/warranty' }))
      ;(sessions ?? []).forEach((row) => next.push({ title: 'Inspection still open', why: 'Closeout evidence may be incomplete', href: row.lead_id ? `/passport/${row.lead_id}` : '/inspections' }))
      setItems(next.slice(0, 12))
      setLoading(false)
    }
    void load()
    return () => { cancelled = true }
  }, [])

  return (
    <div className="space-y-4 p-1 pb-4">
      <button onClick={() => router.push('/')} className="text-cyan-300 text-sm mb-3">← Dashboard</button>
      <h1 className="text-2xl font-bold">Owner brief</h1>
      <p className="text-sm text-slate-300 mb-4">Exceptions only. Not another dashboard to hunt through.</p>
      {loading && <p className="text-sm text-slate-400">Building today’s exceptions…</p>}
      {error && <p className="text-sm text-red-300">{error}</p>}
      {!loading && !error && items.length === 0 && <p className="text-sm text-slate-400">No blockers in the current records.</p>}
      {items.map((item, index) => (
        <button key={`${item.href}-${index}`} onClick={() => router.push(item.href)} className="w-full text-left glass rounded-xl p-4 mb-3">
          <p className="font-semibold">{item.title}</p>
          <p className="text-sm text-slate-400">{item.why}</p>
        </button>
      ))}
    </div>
  )
}
