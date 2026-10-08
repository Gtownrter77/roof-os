'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '../../lib/supabase/client'

type Invoice = {
  id: string
  invoice_number: string
  amount_cents: number
  currency: string
  status: 'draft' | 'issued' | 'paid' | 'void'
  due_at: string | null
  created_at: string
  lead_id: string | null
  stage?: 'deposit' | 'progress' | 'final'
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [contractTotal] = useState<number>(18500) // $18,500 contract example

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()
    supabase
      .from('invoices')
      .select('id,invoice_number,amount_cents,currency,status,due_at,created_at,lead_id')
      .order('created_at', { ascending: false })
      .limit(100)
      .then(({ data, error: queryError }) => {
        if (cancelled) return
        if (queryError) {
          setError('Invoices could not be loaded.')
          setLoading(false)
          return
        }
        setInvoices((data ?? []) as Invoice[])
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  const totalPaidCents = useMemo(
    () => invoices.filter((invoice) => invoice.status === 'paid').reduce((sum, invoice) => sum + invoice.amount_cents, 0),
    [invoices],
  )
  const totalPaid = totalPaidCents / 100
  const pendingCount = invoices.filter((invoice) => invoice.status === 'issued').length

  const depositCents = useMemo(
    () => invoices.filter((inv) => inv.status === 'paid' && (inv.stage === 'deposit' || inv.invoice_number.toLowerCase().includes('dep'))).reduce((sum, inv) => sum + inv.amount_cents, 0),
    [invoices]
  )
  const depositPaid = depositCents / 100
  const targetDeposit = contractTotal * 0.50
  const depositShortfall = Math.max(0, targetDeposit - depositPaid)

  const formatMoney = (amountCents: number, currency = 'USD') =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(amountCents / 100)

  const statusLabel = (status: Invoice['status']) => status.charAt(0).toUpperCase() + status.slice(1)

  const getStatusColor = (status: Invoice['status']) => {
    const colors: Record<Invoice['status'], string> = {
      paid: 'bg-emerald-100 text-emerald-800',
      issued: 'bg-amber-100 text-amber-800',
      void: 'bg-red-100 text-red-800',
      draft: 'bg-gray-100 text-gray-800',
    }
    return colors[status]
  }

  return (
    <main className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-blue-600 text-white shadow-lg sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center justify-between">
          <h1 className="text-xl font-bold">Invoices & Progress Billing Ledger</h1>
          <span className="text-xs bg-blue-800 text-white px-2.5 py-1 rounded font-mono font-semibold">
            Contract Total: ${contractTotal.toLocaleString()}
          </span>
        </div>
      </header>

      <div className="p-4 space-y-4">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-white rounded-lg shadow p-3">
            <p className="text-[10px] uppercase font-bold text-gray-500">Paid Invoiced</p>
            <p className="text-lg font-bold text-blue-600">
              {loading ? '—' : `$${totalPaid.toLocaleString()}`}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-3">
            <p className="text-[10px] uppercase font-bold text-gray-500">Deposit Received</p>
            <p className="text-lg font-bold text-emerald-600">
              {loading ? '—' : `$${depositPaid.toLocaleString()}`}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-3">
            <p className="text-[10px] uppercase font-bold text-gray-500">Issued Pending</p>
            <p className="text-lg font-bold text-amber-600">{loading ? '—' : pendingCount}</p>
          </div>
        </div>

        {depositShortfall > 0 && (
          <div className="bg-amber-50 border-l-4 border-amber-500 p-3 rounded shadow text-xs text-amber-900 flex justify-between items-center">
            <div>
              <p className="font-bold">⚠️ 50% Deposit Shortfall Detected</p>
              <p>Target Deposit: ${targetDeposit.toLocaleString()} (50%). Shortfall: <strong>${depositShortfall.toLocaleString()}</strong>.</p>
            </div>
            <span className="bg-amber-200 text-amber-900 px-2 py-1 rounded font-bold uppercase text-[10px]">Action Required</span>
          </div>
        )}

        {error && <div className="bg-red-50 border border-red-200 text-red-800 p-3 rounded-lg text-sm" role="alert">{error}</div>}

        <section className="bg-white rounded-lg shadow">
          <div className="p-3 border-b flex justify-between items-center">
            <p className="text-sm font-bold text-gray-800">3-Stage Progress Billing Reconciliation</p>
            <span className="text-xs text-gray-500">50% Deposit / 30% Progress / 20% Final</span>
          </div>

          {loading ? (
            <p className="p-4 text-sm text-gray-500">Loading invoices…</p>
          ) : invoices.length === 0 ? (
            <div className="p-6 text-center">
              <p className="font-medium text-gray-800">No invoices recorded</p>
              <p className="text-sm text-gray-500 mt-1">Invoices will appear here after they are created for this workspace.</p>
            </div>
          ) : (
            invoices.map((invoice) => (
              <div key={invoice.id} className="p-3 border-b last:border-0 flex justify-between items-center">
                <div>
                  <p className="font-bold text-sm text-gray-900">{invoice.invoice_number}</p>
                  <p className="text-xs text-gray-500">
                    {invoice.lead_id ? `Lead ${invoice.lead_id.slice(0, 8)}` : 'No lead linked'}
                  </p>
                  <p className="text-[10px] text-gray-400">
                    {invoice.due_at ? `Due ${new Date(invoice.due_at).toLocaleDateString()}` : new Date(invoice.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-sm text-gray-900">{formatMoney(invoice.amount_cents, invoice.currency)}</p>
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${getStatusColor(invoice.status)}`}>
                    {statusLabel(invoice.status)}
                  </span>
                </div>
              </div>
            ))
          )}
        </section>
      </div>
    </main>
  )
}
