'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { smartBack } from '../../lib/smart-back'
import { createClient } from '../../lib/supabase/client'

type Session = { id: string; status: string; started_at: string; lead_id: string | null; leadName: string; leadAddress: string }

function flatten(row: any): Session {
  const lead = Array.isArray(row.leads) ? row.leads[0] : row.leads
  return {
    id: row.id,
    status: row.status,
    started_at: row.started_at,
    lead_id: row.lead_id ?? null,
    leadName: lead?.name || 'Unlinked inspection',
    leadAddress: lead?.address || 'No address',
  }
}

export default function InspectionsPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [sessions, setSessions] = useState<Session[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/auth/enter'); return }
      const { data, error: queryError } = await supabase.from('inspection_sessions').select('id,status,started_at,lead_id,leads(name,address)').order('started_at', { ascending: false }).limit(50)
      if (queryError) setError(queryError.message)
      else setSessions((data ?? []).map(flatten))
      setLoading(false)
    }
    void load()
  }, [router, supabase])

  return (
    <main className="space-y-4"><div className="mx-auto max-w-[1180px] p-4 pb-16 md:p-6"><header className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><button onClick={() => smartBack(router)} className="mb-2 text-xs text-cyan-300">← Back</button><p className="ops-label">Field operations</p><h1 className="text-3xl font-black">Inspections</h1><p className="mt-1 text-sm text-slate-400">Capture real roof evidence, review it, and keep storm jobs moving.</p></div><button onClick={() => router.push('/leads')} className="rounded-lg bg-gradient-to-r from-red-600 to-rose-500 px-4 py-2 text-sm font-bold text-white">Start from a lead</button></header><div className="mb-4 grid gap-3 sm:grid-cols-3"><div className="glass rounded-xl p-4"><p className="ops-label">Sessions</p><strong className="text-2xl text-cyan-300">{loading ? '—' : sessions.length}</strong></div><div className="glass rounded-xl p-4"><p className="ops-label">Latest status</p><strong className="text-lg text-emerald-300">{sessions[0]?.status?.replace('_', ' ') || 'Ready'}</strong></div><div className="glass rounded-xl p-4"><p className="ops-label">Evidence rule</p><strong className="text-sm text-slate-200">Actual photos only</strong></div></div>{error && <p className="mb-3 rounded-lg border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-300" role="alert">{error}</p>}{loading && <div className="glass rounded-xl p-6 text-sm text-slate-400">Loading inspection sessions…</div>}{!loading && sessions.length === 0 && !error && <div className="glass rounded-xl p-8 text-center text-sm text-slate-400">No inspection sessions yet. Open a lead and choose Start inspection now.</div>}<div className="grid gap-3 md:grid-cols-2">{sessions.map((item) => <article key={item.id} className="glass rounded-xl p-4 transition hover:border-cyan-400/60"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-white">{item.leadName}</p><p className="mt-1 text-sm text-slate-400">{item.leadAddress}</p></div><span className="rounded bg-violet-400/15 px-2 py-1 text-xs font-semibold text-violet-300">{item.status.replace('_', ' ')}</span></div><p className="mt-3 text-xs text-slate-500">Started {new Date(item.started_at).toLocaleString()}</p><div className="mt-4 flex gap-2">{item.lead_id && <button onClick={() => router.push(`/leads/${item.lead_id}`)} className="rounded border border-white/15 px-3 py-1.5 text-xs text-slate-300 hover:border-cyan-400/60">Open lead</button>}<button onClick={() => router.push(`/camera?inspection=${item.id}${item.lead_id ? `&lead=${item.lead_id}` : ''}`)} className="rounded bg-cyan-500/15 px-3 py-1.5 text-xs font-semibold text-cyan-300">Open photos</button></div></article>)}</div></div></main>
  )
}
