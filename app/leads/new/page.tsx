'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../../lib/supabase/client'

export default function NewLeadPage() {
  const router = useRouter()
  const supabase = createClient()
  const [form, setForm] = useState({ name: '', address: '', phone: '', email: '', source: '', notes: '' })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true); setError('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); router.replace(`/auth/login?next=${encodeURIComponent('/leads/new')}`); return }
    const name = form.name.trim()
    const address = form.address.trim()
    if (!name || !address) { setError('Name and address are required.'); setSaving(false); return }
    const { data: workspaceId, error: workspaceError } = await supabase.rpc('current_workspace_id')
    if (workspaceError || !workspaceId) { setError(workspaceError?.message ?? 'No workspace is available.'); setSaving(false); return }
    const { data, error: insertError } = await supabase.from('leads').insert({ name, address, phone: form.phone.trim() || null, email: form.email.trim() || null, source: form.source.trim() || 'manual', notes: form.notes.trim() || null, owner_id: user.id, workspace_id: workspaceId, status: 'new' }).select('id').single()
    if (insertError || !data) {
      const detail = insertError?.message ?? ''
      setError(detail.includes('tasks_automation_key_unique_idx') || detail.includes('ON CONFLICT')
        ? 'Lead automation is not initialized in this workspace. Ask an administrator to apply the latest Supabase migrations.'
        : detail || 'Lead was not created.'); setSaving(false); return
    }
    const { error: activityError } = await supabase.from('lead_activity').insert({ lead_id: data.id, workspace_id: workspaceId, user_id: user.id, kind: 'note', body: form.notes.trim() || `Lead created from ${form.source.trim() || 'manual'}` })
    if (activityError) { setError(`Lead created, but the activity note was not saved: ${activityError.message}`); setSaving(false); return }
    router.push(`/leads/${data.id}`)
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24">
      <button onClick={() => router.back()} className="text-blue-600 mb-4">← Back</button>
      <h1 className="text-2xl font-bold mb-4">New Lead</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input type="text" placeholder="Name *" required className="w-full p-3 border rounded-lg" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input type="text" placeholder="Address *" required className="w-full p-3 border rounded-lg" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        <input type="tel" placeholder="Phone" className="w-full p-3 border rounded-lg" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        <input type="email" placeholder="Email" className="w-full p-3 border rounded-lg" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <input type="text" placeholder="Source (storm, referral, website)" className="w-full p-3 border rounded-lg" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} />
        <textarea placeholder="First note" className="w-full p-3 border rounded-lg" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={saving} className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold disabled:opacity-60">{saving ? 'Saving…' : 'Save Lead'}</button>
      </form>
    </div>
  )
}
