'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '../../lib/supabase/client'
import { CANVASS_LEAD_SOURCE, isCanvassSource } from '../../lib/canvass'

const statuses = ['all', 'new', 'assigned', 'qualified', 'inspection_scheduled', 'inspected', 'report_pending', 'report_approved', 'won', 'lost']
const priorityFilters = ['all', 'hot', 'warm', 'cold', 'needs_action', 'overdue']
const sourceFilters = ['all', 'canvass', 'other'] as const

type Lead = {
  id: string
  name: string
  address: string
  status: string
  phone?: string | null
  email?: string | null
  source?: string | null
  next_action?: string | null
  next_action_due?: string | null
  lead_score?: number
}

export default function LeadsClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = useMemo(() => createClient(), [])
  const initialSource = searchParams.get('source') === 'canvass' ? 'canvass' : 'all'
  const [leads, setLeads] = useState<Lead[]>([])
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [priority, setPriority] = useState('all')
  const [source, setSource] = useState<(typeof sourceFilters)[number]>(initialSource)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const next = searchParams.get('source') === 'canvass' ? 'canvass' : 'all'
    setSource(next)
  }, [searchParams])

  useEffect(() => {
    let active = true
    async function loadLeads() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/auth/login?next=/leads')
        return
      }
      const { data, error: queryError } = await supabase
        .from('leads')
        .select('id,name,address,status,phone,email,source,next_action,next_action_due,lead_score')
        .order('lead_score', { ascending: false })
        .order('created_at', { ascending: false })
      if (!active) return
      if (queryError) setError(queryError.message)
      else setLeads(data ?? [])
      setLoading(false)
    }
    void loadLeads()
    return () => { active = false }
  }, [router, supabase])

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const now = Date.now()
    return leads.filter((lead) => {
      const score = lead.lead_score ?? 0
      const due = lead.next_action_due ? new Date(lead.next_action_due).getTime() : null
      const hasNextAction = Boolean(lead.next_action?.trim())
      const overdue = due !== null && due < now
      const needsAction = !hasNextAction && !['won', 'lost'].includes(lead.status)
      const priorityMatch =
        priority === 'all'
        || (priority === 'hot' && score >= 70)
        || (priority === 'warm' && score >= 40 && score < 70)
        || (priority === 'cold' && score < 40)
        || (priority === 'needs_action' && needsAction)
        || (priority === 'overdue' && overdue)
      const canvass = isCanvassSource(lead.source)
      const sourceMatch =
        source === 'all'
        || (source === 'canvass' && canvass)
        || (source === 'other' && !canvass)
      const textMatch = !needle || [lead.name, lead.address, lead.phone, lead.email, lead.next_action, lead.source]
        .some((value) => (value || '').toLowerCase().includes(needle))
      return (status === 'all' || lead.status === status) && priorityMatch && sourceMatch && textMatch
    })
  }, [leads, query, status, priority, source])

  function onSourceChange(next: (typeof sourceFilters)[number]) {
    setSource(next)
    const url = next === 'canvass' ? '/leads?source=canvass' : '/leads'
    router.replace(url)
  }

  return (
    <main className="space-y-4">
      <div className="mx-auto max-w-[1180px] p-4 pb-16 md:p-6">
        <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <button type="button" onClick={() => router.push('/')} className="mb-2 text-xs text-cyan-300">← Command center</button>
            <p className="ops-label">Opportunity control</p>
            <h1 className="text-3xl font-black tracking-tight">Leads</h1>
            <p className="mt-1 text-sm text-slate-400">
              One pipeline — canvass knocks land here with source {CANVASS_LEAD_SOURCE.replaceAll('_', ' ')}.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => router.push('/canvass')}
              className="rounded-lg border border-cyan-400/40 px-4 py-2 text-sm font-bold text-cyan-200 hover:bg-cyan-400/10"
            >
              Field canvass
            </button>
            <button
              type="button"
              onClick={() => router.push('/leads/new')}
              className="rounded-lg bg-gradient-to-r from-red-600 to-rose-500 px-4 py-2 text-sm font-bold text-white"
            >
              + New lead
            </button>
          </div>
        </header>

        <section className="glass mb-4 rounded-xl p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold">Pipeline filters</h2>
            <span className="text-xs text-slate-400">{loading ? 'Syncing…' : `${visible.length} of ${leads.length} visible`}</span>
          </div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, address, phone"
              className="rounded-lg border border-white/15 bg-black/25 p-3 text-sm text-white placeholder:text-slate-500"
            />
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-lg border border-white/15 bg-[#0a1427] px-3 text-sm text-white">
              {statuses.map((item) => <option key={item} value={item}>{item.replaceAll('_', ' ')}</option>)}
            </select>
            <select value={priority} onChange={(e) => setPriority(e.target.value)} className="rounded-lg border border-white/15 bg-[#0a1427] px-3 text-sm text-white">
              {priorityFilters.map((item) => <option key={item} value={item}>{item.replaceAll('_', ' ')}</option>)}
            </select>
            <select
              value={source}
              onChange={(e) => onSourceChange(e.target.value as (typeof sourceFilters)[number])}
              className="rounded-lg border border-white/15 bg-[#0a1427] px-3 text-sm text-white"
              aria-label="Lead source filter"
            >
              <option value="all">all sources</option>
              <option value="canvass">canvass only</option>
              <option value="other">non-canvass</option>
            </select>
          </div>
        </section>

        {loading && <div className="glass rounded-xl p-5 text-sm text-slate-400">Loading lead intelligence…</div>}
        {error && <p className="mb-3 rounded-lg border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-300" role="alert">{error}</p>}
        {!loading && visible.length === 0 && (
          <div className="glass rounded-xl p-8 text-center text-sm text-slate-400">No leads match these filters.</div>
        )}

        <div className="space-y-3">
          {visible.map((lead) => {
            const score = lead.lead_score ?? 0
            const overdue = Boolean(lead.next_action_due && new Date(lead.next_action_due).getTime() < Date.now())
            const needsAction = !lead.next_action?.trim() && !['won', 'lost'].includes(lead.status)
            const canvass = isCanvassSource(lead.source)
            return (
              <button
                key={lead.id}
                type="button"
                onClick={() => router.push(`/leads/${lead.id}`)}
                className="glass w-full rounded-xl p-4 text-left transition hover:border-cyan-400/60 hover:bg-white/10"
              >
                <div className="flex justify-between gap-3">
                  <div>
                    <p className="font-semibold text-white">{lead.name}</p>
                    <p className="text-sm text-slate-400">{lead.address}</p>
                    <p className="mt-1 text-xs text-slate-500">{lead.phone || 'No phone'} · {lead.email || 'No email'}</p>
                  </div>
                  <div className="text-right space-y-1">
                    <span className="rounded bg-cyan-400/15 px-2 py-1 text-xs font-semibold text-cyan-300">{lead.status.replaceAll('_', ' ')}</span>
                    {canvass && (
                      <div>
                        <span className="rounded bg-amber-400/15 px-2 py-1 text-xs font-semibold text-amber-200">canvass</span>
                      </div>
                    )}
                    <p className="mt-2 text-xl font-black text-white">
                      {score}<span className="text-xs font-normal text-slate-500">/100</span>
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-3 border-t border-white/10 pt-3 text-xs">
                  {needsAction && <span className="text-red-400">Needs next action</span>}
                  {overdue && <span className="text-amber-300">Follow-up overdue</span>}
                  {!needsAction && !overdue && lead.next_action && <span className="text-slate-300">Next: {lead.next_action}</span>}
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </main>
  )
}
