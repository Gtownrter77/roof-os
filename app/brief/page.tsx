'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase/client'

type Item = { title: string; why: string; href: string }

export default function BriefPage() {
  const router = useRouter()
  const supabase = createClient()
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const now = new Date().toISOString()
      const [{ data: cold }, { data: tasks }, { data: warranties }, { data: sessions }] = await Promise.all([
        supabase.from('leads').select('id,name,status,created_at').in('status', ['new', 'qualified', 'report_pending']).order('created_at', { ascending: true }).limit(20),
        supabase.from('tasks').select('id,title,due_at,lead_id,status').eq('status', 'open').limit(20),
        supabase.from('warranties').select('id,manufacturer,registration_status,lead_id,missing_items').in('registration_status', ['not_started', 'packet_ready']).limit(20),
        supabase.from('inspection_sessions').select('id,lead_id,status').eq('status', 'in_progress').limit(20),
      ])
      const next: Item[] = []
      ;(cold ?? []).forEach((lead) => next.push({ title: `Move ${lead.name}`, why: `Stuck in ${lead.status.replaceAll('_', ' ')}`, href: `/leads/${lead.id}` }))
      ;(tasks ?? []).filter((task) => task.due_at && task.due_at < now).forEach((task) => next.push({ title: task.title, why: 'Overdue follow-up', href: task.lead_id ? `/leads/${task.lead_id}` : '/tasks' }))
      ;(warranties ?? []).forEach((row) => next.push({ title: `${row.manufacturer} warranty`, why: row.missing_items || 'Registration not complete', href: '/warranty' }))
      ;(sessions ?? []).forEach((row) => next.push({ title: 'Inspection still open', why: 'Closeout evidence may be incomplete', href: row.lead_id ? `/passport/${row.lead_id}` : '/inspections' }))
      setItems(next.slice(0, 12))
      setLoading(false)
    }
    void load()
  }, [supabase])

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24">
      <button onClick={() => router.push('/')} className="text-blue-600 text-sm mb-3">← Dashboard</button>
      <h1 className="text-2xl font-bold">Owner brief</h1>
      <p className="text-sm text-gray-600 mb-4">Exceptions only. Not another dashboard to hunt through.</p>
      {loading && <p className="text-sm text-gray-500">Building today’s exceptions…</p>}
      {!loading && items.length === 0 && <p className="text-sm text-gray-500">No blockers in the current records.</p>}
      {items.map((item, index) => (
        <button key={`${item.href}-${index}`} onClick={() => router.push(item.href)} className="w-full text-left bg-white rounded-lg shadow p-4 mb-3">
          <p className="font-semibold">{item.title}</p>
          <p className="text-sm text-gray-500">{item.why}</p>
        </button>
      ))}
    </div>
  )
}
