'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase/client'

type Invoice = { id: string; invoice_number: string; amount_cents: number; currency: string; status: string; due_at: string | null; created_at: string }

function money(cents: number, currency: string) {
  if (!currency) return 'Unknown'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(cents / 100)
}

export default function InvoicesPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [rows, setRows] = useState<Invoice[]>([])
  const [status, setStatus] = useState('Checking workspace invoices.')

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { if (!cancelled) setStatus('Sign in required.'); return }
      const { data: workspaceId, error: workspaceError } = await supabase.rpc('current_workspace_id')
      if (workspaceError || !workspaceId) { if (!cancelled) setStatus('No workspace is available.'); return }
      const { data, error } = await supabase.from('invoices').select('id,invoice_number,amount_cents,currency,status,due_at,created_at').eq('workspace_id', workspaceId).order('created_at', { ascending: false }).limit(50)
      if (cancelled) return
      if (error) { setStatus(error.message); setRows([]); return }
      setRows(data ?? [])
      setStatus(data && data.length ? 'These are saved invoices for this workspace. Payment provider status is not shown here.' : 'No saved invoices.')
    }
    load()
    return () => { cancelled = true }
  }, [supabase])

  const paid = rows.filter((row) => row.status === 'paid')
  const paidCents = paid.reduce((sum, row) => sum + row.amount_cents, 0)

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-blue-600 text-white shadow-lg sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center">
          <button onClick={() => router.back()} className="text-white mr-3 text-xl">Back</button>
          <h1 className="text-xl font-bold">Invoices</h1>
        </div>
      </header>
      <main className="p-4 space-y-3">
        <p className="text-sm bg-white rounded-lg shadow p-4">{status}</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-xs text-gray-500">Saved status paid. Provider not checked.</p>
            <p className="text-xl font-bold">{paid.length ? money(paidCents, paid[0].currency) : 'Unknown'}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-xs text-gray-500">Issued</p>
            <p className="text-xl font-bold">{rows.filter((row) => row.status === 'issued').length}</p>
          </div>
        </div>
        {rows.map((row) => (
          <div key={row.id} className="bg-white rounded-lg shadow p-4">
            <p className="font-semibold text-sm">{row.invoice_number}</p>
            <p className="text-sm">{money(row.amount_cents, row.currency)}</p>
            <p className="text-xs text-gray-500">{row.status} · {row.created_at ? new Date(row.created_at).toLocaleString() : 'Unknown'}</p>
          </div>
        ))}
      </main>
    </div>
  )
}
