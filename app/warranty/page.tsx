'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase/client'

type Warranty = { id: string; manufacturer: string | null; product_line: string | null; registration_status: string; expires_at: string | null; missing_items: string | null; lead_id: string | null }
type LeadOption = { id: string; name: string }

export default function WarrantyPage() {
  const router = useRouter()
  const supabase = createClient()
  const [rows, setRows] = useState<Warranty[]>([])
  const [leads, setLeads] = useState<LeadOption[]>([])
  const [form, setForm] = useState({ leadId: '', manufacturer: 'GAF', product_line: 'Timberline HDZ', expires_at: '', missing_items: '' })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const load = async () => {
    const [w, l] = await Promise.all([
      supabase.from('warranties').select('id,manufacturer,product_line,registration_status,expires_at,missing_items,lead_id').order('created_at', { ascending: false }),
      supabase.from('leads').select('id,name').order('created_at', { ascending: false }).limit(100),
    ])
    if (w.error) setError(w.error.message)
    else setRows(w.data ?? [])
    setLeads(l.data ?? [])
  }

  useEffect(() => { void load() }, [])

  const add = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true); setError('')
    const { data: { user } } = await supabase.auth.getUser()
    const { data: workspaceId } = await supabase.rpc('current_workspace_id')
    if (!user || !workspaceId) { setError('No workspace.'); setSaving(false); return }
    const { error: insertError } = await supabase.from('warranties').insert({
      workspace_id: workspaceId,
      lead_id: form.leadId || null,
      manufacturer: form.manufacturer,
      product_line: form.product_line,
      expires_at: form.expires_at || null,
      missing_items: form.missing_items || null,
      registration_status: form.missing_items ? 'not_started' : 'packet_ready',
      created_by: user.id,
    })
    if (insertError) setError(insertError.message)
    else { setForm({ leadId: '', manufacturer: 'GAF', product_line: 'Timberline HDZ', expires_at: '', missing_items: '' }); await load() }
    setSaving(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24">
      <button onClick={() => router.push('/')} className="text-blue-600 text-sm mb-3">← Dashboard</button>
      <h1 className="text-2xl font-bold mb-2">Warranties</h1>
      <p className="text-sm text-gray-600 mb-4">Registration status, expiration, and missing packet items. This is not just a PDF slot.</p>
      <form onSubmit={add} className="bg-white rounded-lg shadow p-4 mb-4 space-y-2">
        <select value={form.leadId} onChange={(e) => setForm({ ...form, leadId: e.target.value })} className="w-full border rounded p-2 text-sm"><option value="">Unlinked property</option>{leads.map((lead) => <option key={lead.id} value={lead.id}>{lead.name}</option>)}</select>
        <input value={form.manufacturer} onChange={(e) => setForm({ ...form, manufacturer: e.target.value })} className="w-full border rounded p-2 text-sm" placeholder="Manufacturer" />
        <input value={form.product_line} onChange={(e) => setForm({ ...form, product_line: e.target.value })} className="w-full border rounded p-2 text-sm" placeholder="Product line" />
        <input type="date" value={form.expires_at} onChange={(e) => setForm({ ...form, expires_at: e.target.value })} className="w-full border rounded p-2 text-sm" />
        <input value={form.missing_items} onChange={(e) => setForm({ ...form, missing_items: e.target.value })} className="w-full border rounded p-2 text-sm" placeholder="Missing: delivery ticket, chimney photo, signed CO" />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button disabled={saving} className="w-full bg-blue-600 text-white py-2 rounded font-semibold disabled:opacity-60">{saving ? 'Saving…' : 'Add warranty record'}</button>
      </form>
      {rows.map((row) => (
        <div key={row.id} className="bg-white rounded-lg shadow p-4 mb-3">
          <p className="font-semibold">{row.manufacturer} {row.product_line}</p>
          <p className="text-sm text-gray-600">{row.registration_status.replaceAll('_', ' ')}{row.expires_at ? ` · expires ${row.expires_at}` : ''}</p>
          {row.missing_items && <p className="text-xs text-amber-800 mt-1">Missing: {row.missing_items}</p>}
          {row.lead_id && <button onClick={() => router.push(`/passport/${row.lead_id}`)} className="text-xs text-blue-600 mt-2">Open passport</button>}
        </div>
      ))}
    </div>
  )
}
