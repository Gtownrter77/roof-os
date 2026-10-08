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
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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

  const totalPaid = useMemo(
    () => invoices.filter((invoice) => invoice.status === 'paid').reduce((sum, invoice) => sum + invoice.amount_cents, 0),
    [invoices],
  )
  const pendingCount = invoices.filter((invoice) => invoice.status === 'issued').length

  const formatMoney = (invoice: Invoice) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: invoice.currency.toUpperCase() }).format(invoice.amount_cents / 100)

  const statusLabel = (status: Invoice['status']) => status.charAt(0).toUpperCase() + status.slice(1)

  const getStatusColor = (status: Invoice['status']) => {
    const colors: Record<Invoice['status'], string> = {
      paid: 'bg-green-100 text-green-800',
      issued: 'bg-yellow-100 text-yellow-800',
      void: 'bg-red-100 text-red-800',
      draft: 'bg-gray-100 text-gray-800',
    }
    return colors[status]
  }

  return (
    <main className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-blue-600 text-white shadow-lg sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center">
          <h1 className="text-xl font-bold">Invoices</h1>
        </div>
      </header>

      <div className="p-4">
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <p className="text-xs text-gray-500">Paid Invoiced</p>
            <p className="text-xl font-bold text-blue-600">
              {loading ? '—' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totalPaid / 100)}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <p className="text-xs text-gray-500">Issued</p>
            <p className="text-xl font-bold text-yellow-600">{loading ? '—' : pendingCount}</p>
          </div>
        </div>

        {error && <div className="bg-red-50 border border-red-200 text-red-800 p-3 rounded-lg mb-4 text-sm" role="alert">{error}</div>}

        <section className="bg-white rounded-lg shadow">
          <div className="p-3 border-b">
            <p className="text-sm font-medium">Recent Invoices</p>
          </div>

          {loading ? (
            <p className="p-4 text-sm text-gray-500">Loading invoices…</p>
          ) : invoices.length === 0 ? (
            <div className="p-6 text-center">
              <p className="font-medium">No invoices recorded</p>
              <p className="text-sm text-gray-500 mt-1">Invoices will appear here after they are created for this workspace.</p>
            </div>
          ) : (
            invoices.map((invoice) => (
              <div key={invoice.id} className="p-3 border-b last:border-0 flex justify-between items-center">
                <div>
                  <p className="font-medium text-sm">{invoice.invoice_number}</p>
                  <p className="text-xs text-gray-500">
                    {invoice.lead_id ? `Lead ${invoice.lead_id.slice(0, 8)}` : 'No lead linked'}
                  </p>
                  <p className="text-xs text-gray-400">
                    {invoice.due_at ? `Due ${new Date(invoice.due_at).toLocaleDateString()}` : new Date(invoice.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-sm">{formatMoney(invoice)}</p>
                  <span className={`text-xs px-2 py-0.5 rounded ${getStatusColor(invoice.status)}`}>
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
