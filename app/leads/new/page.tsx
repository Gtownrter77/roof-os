'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { smartBack } from '../../../lib/smart-back'
import { createClient } from '../../../lib/supabase/client'

export default function NewLeadPage() {
  const router = useRouter()
  const supabase = createClient()
  const [form, setForm] = useState({ name: '', address: '', phone: '', email: '', source: '', notes: '', nextAction: '', nextActionDue: '' })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true); setError('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.replace('/auth/login'); return }
    const { data: workspaceId, error: workspaceError } = await supabase.rpc('current_workspace_id')
    if (workspaceError || !workspaceId) { setError(workspaceError?.message ?? 'No workspace is available.'); setSaving(false); return }
    const nextDue = form.nextActionDue ? new Date(form.nextActionDue).toISOString() : null
    const { data, error: insertError } = await supabase.from('leads').insert({
      name: form.name.trim(),
      address: form.address.trim(),
      phone: form.phone || null,
      email: form.email || null,
      source: form.source || 'manual',
      notes: form.notes || null,
      owner_id: user.id,
      workspace_id: workspaceId,
      status: 'new',
      next_action: form.nextAction.trim() || 'First contact',
      next_action_due: nextDue,
      next_action_owner_id: user.id,
    }).select('id').single()
    if (insertError || !data) { setError(insertError?.message ?? 'Lead was not created.'); setSaving(false); return }
    await supabase.from('lead_activity').insert({ lead_id: data.id, workspace_id: workspaceId, user_id: user.id, kind: 'created', body: form.notes || `Lead created from ${form.source || 'manual'}` })
    router.push(`/leads/${data.id}`)
  }

  return (
    <div className="space-y-4 p-1 pb-4">
      <button onClick={() => smartBack(router)} className="text-cyan-300 mb-4">← Back</button>
      <h1 className="text-2xl font-bold mb-4">New Lead</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input type="text" placeholder="Name *" required className="ops-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input type="text" placeholder="Address *" required className="ops-input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        <input type="tel" placeholder="Phone" className="ops-input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        <input type="email" placeholder="Email" className="ops-input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <input type="text" placeholder="Source (storm, referral, website)" className="ops-input" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} />
        <input type="text" placeholder="Next action (default: First contact)" className="ops-input" value={form.nextAction} onChange={(e) => setForm({ ...form, nextAction: e.target.value })} />
        <input type="datetime-local" aria-label="Next action due" className="ops-input" value={form.nextActionDue} onChange={(e) => setForm({ ...form, nextActionDue: e.target.value })} />
        <textarea placeholder="First note" className="ops-input" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        {error && <p className="text-sm text-red-300">{error}</p>}
        <button type="submit" disabled={saving} className="ops-btn-primary w-full py-3 disabled:opacity-60">{saving ? 'Saving…' : 'Save Lead'}</button>
      </form>
    </div>
  )
}
