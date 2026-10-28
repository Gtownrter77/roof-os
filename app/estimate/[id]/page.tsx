'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'

type LineItem = {
  id: string
  item_code: string
  description: string
  category: string
  unit: string
  quantity: number
  unit_cost: number
  line_total: number
}

type Estimate = {
  id: string
  status: string
  subtotal: number
  tax: number
  total: number
  created_at: string
  estimate_snapshot?: {
    customer?: { name?: string; email?: string; phone?: string }
    property?: { address?: string; city?: string; state?: string; zip?: string }
    notes?: { customer?: string; internal?: string }
  }
  line_items?: LineItem[]
}

const money = (amount: number | null | undefined) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(amount ?? 0))

export default function EstimateDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [estimate, setEstimate] = useState<Estimate | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) return
    const controller = new AbortController()
    fetch('/api/estimates/' + encodeURIComponent(id), { signal: controller.signal, cache: 'no-store' })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}))
        if (!response.ok || !data.estimate) throw new Error(data.error || 'Could not load estimate.')
        setEstimate(data.estimate)
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Could not load estimate.')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [id])

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-8">
      <div className="max-w-4xl mx-auto space-y-5">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link href="/estimate" className="text-cyan-300 text-sm hover:underline">← All estimates</Link>
            <h1 className="mt-2 text-2xl font-bold">Estimate details</h1>
          </div>
          {estimate && (estimate.status === 'draft' || estimate.status === 'pending_approval') && (
            <Link href={'/estimate/' + encodeURIComponent(estimate.id) + '/edit'} className="rounded-lg bg-emerald-600 px-4 py-2 font-semibold hover:bg-emerald-500">
              Edit estimate
            </Link>
          )}
        </header>
        {loading && <p role="status">Loading estimate…</p>}
        {error && <p role="alert" className="rounded border border-red-500 p-3 text-red-200">{error}</p>}
        {!loading && estimate && (
          <>
            <section className="rounded-xl border border-white/10 bg-slate-900 p-5 space-y-3">
              <div className="flex justify-between gap-4">
                <p className="font-semibold">Status: {estimate.status.replaceAll('_', ' ')}</p>
                <p className="text-sm text-slate-400">Created {new Date(estimate.created_at).toLocaleDateString()}</p>
              </div>
              <p className="text-xl font-bold">{estimate.estimate_snapshot?.customer?.name || 'Customer not assigned'}</p>
              <p className="text-slate-300">{estimate.estimate_snapshot?.property?.address || 'Property address not provided'}</p>
              <p className="text-sm text-slate-400">{estimate.estimate_snapshot?.customer?.email || ''}</p>
            </section>
            <section className="rounded-xl border border-white/10 bg-slate-900 p-5">
              <h2 className="font-semibold mb-4">Estimate line items</h2>
              {(estimate.line_items || []).length === 0 ? (
                <p className="text-slate-400">No line items saved. This estimate is not ready for approval.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-white/15 text-left text-slate-300"><th className="py-2">Description</th><th>Qty</th><th>Unit</th><th>Unit cost</th><th className="text-right">Total</th></tr></thead>
                    <tbody>
                      {estimate.line_items.map((item) => (
                        <tr key={item.id} className="border-b border-white/10">
                          <td className="py-3 pr-3">{item.description}</td>
                          <td>{item.quantity}</td><td>{item.unit}</td><td>{money(item.unit_cost)}</td>
                          <td className="text-right">{money(item.line_total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <dl className="mt-5 ml-auto max-w-xs space-y-2 border-t border-white/10 pt-4">
                <div className="flex justify-between"><dt>Subtotal</dt><dd>{money(estimate.subtotal)}</dd></div>
                <div className="flex justify-between"><dt>Tax</dt><dd>{money(estimate.tax)}</dd></div>
                <div className="flex justify-between text-lg font-bold"><dt>Total</dt><dd>{money(estimate.total)}</dd></div>
              </dl>
            </section>
            {estimate.estimate_snapshot?.notes?.customer && (
              <section className="rounded-xl border border-white/10 bg-slate-900 p-5">
                <h2 className="font-semibold mb-2">Customer notes</h2>
                <p className="whitespace-pre-wrap text-sm text-slate-300">{estimate.estimate_snapshot.notes.customer}</p>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  )
}
