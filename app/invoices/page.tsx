'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase/client'

type Invoice = {
  id: string
  invoice_number: string
  amount_cents: number
  currency: string
  status: 'draft' | 'issued' | 'paid' | 'void'
  due_at: string | null
  created_at: string
  leads: { name: string } | null
}

function formatMoney(cents: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: currency.toUpperCase() }).format(cents / 100)
  } catch {
    return `${currency.toUpperCase()} ${(cents / 100).toFixed(2)}`
  }
}

function statusClass(status: Invoice['status']) {
  if (status === 'paid') return 'bg-green-100 text-green-800'
  if (status === 'issued') return 'bg-yellow-100 text-yellow-800'
  if (status === 'void') return 'bg-red-100 text-red-800'
  return 'bg-gray-100 text-gray-800'
}

export default function InvoicesPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    async function loadInvoices() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/auth/login')
        return
      }

      const { data, error: queryError } = await supabase
        .from('invoices')
        .select('id,invoice_number,amount_cents,currency,status,due_at,created_at,leads(name)')
        .order('created_at', { ascending: false })
        .limit(100)

      if (!active) return
      if (queryError) setError(queryError.message)
      else setInvoices((data ?? []) as unknown as Invoice[])
      setLoading(false)
    }

    void loadInvoices()
    return () => {
      active = false
    }
  }, [router, supabase])

  const stats = useMemo(() => ({
    total: invoices.length,
    paid: invoices.filter((invoice) => invoice.status === 'paid').length,
    outstanding: invoices.filter((invoice) => invoice.status === 'issued').length,
  }), [invoices])

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-blue-600 text-white shadow-lg sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center">
          <button onClick={() => router.back()} className="text-white mr-3 text-xl">←</button>
          <h1 className="text-xl font-bold">📊 Invoices</h1>
        </div>
      </header>

      <main className="p-4">
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <p className="text-xs text-gray-500">Invoices</p>
            <p className="text-xl font-bold text-blue-600">{stats.total}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <p className="text-xs text-gray-500">Paid</p>
            <p className="text-xl font-bold text-green-600">{stats.paid}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <p className="text-xs text-gray-500">Outstanding</p>
            <p className="text-xl font-bold text-yellow-600">{stats.outstanding}</p>
          </div>
        </div>

        {loading && <p className="text-sm text-gray-500">Loading invoices…</p>}
        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
        {!loading && !error && invoices.length === 0 && (
          <p className="text-sm text-gray-500">No invoices are saved in this workspace yet.</p>
        )}

        <div className="bg-white rounded-lg shadow">
          {!loading && invoices.map((invoice) => (
            <div key={invoice.id} className="p-3 border-b last:border-0 flex justify-between items-center">
              <div>
                <p className="font-medium text-sm">{invoice.invoice_number}</p>
                <p className="text-xs text-gray-500">{invoice.leads?.name ?? 'Unlinked customer'}</p>
                <p className="text-xs text-gray-400">
                  {new Date(invoice.created_at).toLocaleDateString()}
                  {invoice.due_at ? ` · Due ${new Date(invoice.due_at).toLocaleDateString()}` : ''}
                </p>
              </div>
              <div className="text-right">
                <p className="font-bold text-sm">{formatMoney(invoice.amount_cents, invoice.currency)}</p>
                <span className={`text-xs px-2 py-0.5 rounded ${statusClass(invoice.status)}`}>
                  {invoice.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around py-2 px-4">
        <button onClick={() => router.push('/')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">🏠</span>
          <span className="text-xs">Home</span>
        </button>
        <button onClick={() => router.push('/portal')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">👥</span>
          <span className="text-xs">Customers</span>
        </button>
        <button onClick={() => router.push('/ai')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">🤖</span>
          <span className="text-xs">AI</span>
        </button>
        <button onClick={() => router.push('/voice-ai')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">🎤</span>
          <span className="text-xs">Voice</span>
        </button>
        <button onClick={() => router.push('/settings')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">⚙️</span>
          <span className="text-xs">Settings</span>
        </button>
      </nav>
    </div>
  )
}
