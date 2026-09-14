'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../../lib/supabase/client'

export default function NewLeadPage() {
  const router = useRouter()
  const supabase = createClient()
  const [form, setForm] = useState({ name: '', address: '', phone: '', email: '' })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.replace('/auth/login'); return }
    const { error: insertError } = await supabase.from('leads').insert({ ...form, owner_id: user.id })
    if (insertError) {
      setError(insertError.message)
      setSaving(false)
      return
    }
    router.push('/leads')
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <button onClick={() => router.back()} className="text-blue-600 mb-4">← Back</button>
      <h1 className="text-2xl font-bold mb-4">➕ New Lead</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input type="text" placeholder="Name *" required className="w-full p-3 border rounded-lg" value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} />
        <input type="text" placeholder="Address *" required className="w-full p-3 border rounded-lg" value={form.address} onChange={(e) => setForm({...form, address: e.target.value})} />
        <input type="tel" placeholder="Phone" className="w-full p-3 border rounded-lg" value={form.phone} onChange={(e) => setForm({...form, phone: e.target.value})} />
        <input type="email" placeholder="Email" className="w-full p-3 border rounded-lg" value={form.email} onChange={(e) => setForm({...form, email: e.target.value})} />
        {error && <p className="text-sm text-red-600" role="alert">Could not save lead: {error}</p>}
        <button type="submit" disabled={saving} className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold disabled:opacity-60">{saving ? 'Saving…' : '💾 Save Lead'}</button>
      </form>
    </div>
  )
}
