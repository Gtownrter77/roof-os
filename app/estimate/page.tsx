'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-slate-500/30 text-slate-200',
  pending_approval: 'bg-amber-500/30 text-amber-200',
  approved: 'bg-emerald-500/30 text-emerald-300',
  rejected: 'bg-red-500/30 text-red-300',
  superseded: 'bg-purple-500/30 text-purple-300',
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  pending_approval: 'Pending Approval',
  approved: 'Approved',
  rejected: 'Rejected',
  superseded: 'Superseded',
}

export default function EstimateListPage() {
  const router = useRouter()
  const [estimates, setEstimates] = useState<Array<any>>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'draft' | 'pending_approval' | 'approved' | 'rejected'>('all')
  const [search, setSearch] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    setLoading(true)
    fetch('/api/estimates')
      .then(async res => {
        const data = await res.json()
        if (res.ok && data.estimates) setEstimates(data.estimates)
        else setErrorMessage(data.error || 'Could not load estimates.')
      })
      .catch(() => setErrorMessage('Could not load estimates. Check your connection.'))
      .finally(() => setLoading(false))
  }, [])

  const filtered = estimates
    .filter(e => filter === 'all' || e.status === filter)
    .filter(e =>
      search === '' ||
      (e.estimate_number?.toLowerCase().includes(search.toLowerCase()) ||
        e.estimate_snapshot?.customer?.name?.toLowerCase().includes(search.toLowerCase()) ||
        e.estimate_snapshot?.property?.address?.toLowerCase().includes(search.toLowerCase()))
    )

  const formatCurrency = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)

  const handleNew = () => router.push('/estimate/new')

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <header className="sticky top-0 z-10 glass border-b border-slate-700/50 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-slate-50">Estimates</h1>
          <div className="flex items-center gap-2">
            <Link href="/templates" className="rounded-lg border border-cyan-500/50 px-3 py-2 text-sm font-semibold text-cyan-200 hover:bg-cyan-500/10">Templates</Link>
            <button onClick={handleNew} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2 rounded-lg flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              New Estimate
            </button>
          </div>
        </div>
        <div className="px-4 pb-4 space-y-3">
          <input
            type="text"
            placeholder="Search estimates..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full p-2 bg-slate-800/50 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-emerald-500"
          />
          <div className="flex gap-2 overflow-x-auto pb-2">
            {(['all', 'draft', 'pending_approval', 'approved', 'rejected'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`whitespace-nowrap px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                  filter === f
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-800/50 text-slate-300 hover:bg-slate-700/50'
                }`}
              >
                {f === 'all' ? 'All' : f.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {errorMessage && <p role="alert" className="mb-4 rounded border border-red-500 p-3 text-red-200">{errorMessage}</p>}
        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="glass rounded-xl p-4 animate-pulse space-y-3">
                <div className="h-4 bg-slate-700/50 rounded w-3/4" />
                <div className="h-3 bg-slate-700/50 rounded w-1/2" />
                <div className="h-3 bg-slate-700/50 rounded w-1/3" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <svg className="w-16 h-16 mx-auto text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
            <p className="mt-4 text-slate-400">No estimates found</p>
            <button onClick={handleNew} className="mt-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-6 py-2 rounded-lg">Create Your First Estimate</button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map(e => (
              <article
                key={e.id}
                className="glass rounded-xl p-4 hover:border-emerald-500/30 transition-colors group"
                onClick={() => router.push(`/estimate/${e.id}`)}
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-50 truncate">{e.estimate_number || `EST-${e.id.slice(0, 8)}`}</p>
                    <p className="text-sm text-slate-400 truncate">{e.estimate_snapshot?.customer?.name || 'Unnamed Customer'}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-xs font-bold shrink-0 ${STATUS_COLORS[e.status] || 'bg-slate-500/30 text-slate-200'}`}>
                    {STATUS_LABELS[e.status] || e.status}
                  </span>
                </div>
                <div className="text-sm text-slate-400 space-y-1">
                  <p className="truncate">{e.estimate_snapshot?.property?.address || 'No address'}</p>
                  <p>{e.estimate_snapshot?.insurance?.company ? `Claim: ${e.estimate_snapshot.insurance.claim_number || e.estimate_snapshot.insurance.company}` : 'No claim'}</p>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-700/50 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-500">Total</p>
                    <p className="text-lg font-bold text-emerald-400">{formatCurrency(Number(e.total ?? 0))}</p>
                  </div>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={event => { event.stopPropagation(); router.push(`/estimate/${e.id}/edit`) }}
                      className="p-2 glass rounded hover:bg-slate-700/50 text-slate-300 hover:text-slate-50"
                      title="Edit"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    </button>
                    <button
                      onClick={async event => {
                        event.stopPropagation()
                        if (confirm('Delete this estimate?')) {
                          try {
                            const response = await fetch(`/api/estimates/${e.id}`, { method: 'DELETE' })
                            if (!response.ok) {
                              const payload = await response.json().catch(() => ({}))
                              setErrorMessage(payload.error || 'Could not delete estimate.')
                              return
                            }
                            setEstimates(prev => prev.filter(est => est.id !== e.id))
                            setErrorMessage('')
                          } catch {
                            setErrorMessage('Could not delete estimate. Check your connection.')
                          }
                        }
                      }}
                      className="p-2 glass rounded hover:bg-red-500/20 text-red-400 hover:text-red-300"
                      title="Delete"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v12m-6 0h12m-6 0h6m-6 0h.01M9 7h12" /></svg>
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>

      <div className="fixed bottom-6 right-6">
        <button onClick={handleNew} className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg flex items-center justify-center transition-transform hover:scale-105">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
        </button>
      </div>
    </div>
  )
}