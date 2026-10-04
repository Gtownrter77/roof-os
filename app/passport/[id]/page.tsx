'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '../../../lib/supabase/client'

type Passport = { id: string; property_address: string; homeowner_name: string | null; material_system: string | null; manufacturer: string | null; color: string | null; install_date: string | null; status: string }

export default function PassportPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = createClient()
  const leadId = params.id
  const [lead, setLead] = useState<{ id: string; name: string; address: string } | null>(null)
  const [passport, setPassport] = useState<Passport | null>(null)
  const [photos, setPhotos] = useState(0)
  const [inspections, setInspections] = useState(0)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ manufacturer: 'GAF', material_system: 'Timberline HDZ', color: '', install_date: '' })

  useEffect(() => {
    async function load() {
      const [{ data: leadRow }, passRes, sessionRes] = await Promise.all([
        supabase.from('leads').select('id,name,address').eq('id', leadId).maybeSingle(),
        supabase.from('roof_passports').select('id,property_address,homeowner_name,material_system,manufacturer,color,install_date,status').eq('lead_id', leadId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('inspection_sessions').select('id').eq('lead_id', leadId),
      ])
      setLead(leadRow)
      setPassport(passRes.data)
      const sessionIds = (sessionRes.data ?? []).map((row: { id: string }) => row.id)
      setInspections(sessionIds.length)
      if (sessionIds.length) {
        const photoRes = await supabase.from('inspection_photos').select('id', { count: 'exact', head: true }).in('inspection_id', sessionIds)
        setPhotos(photoRes.count ?? 0)
      }
    }
    void load()
  }, [leadId, supabase])

  async function createPassport() {
    if (!lead) return
    setSaving(true); setError('')
    const { data: { user } } = await supabase.auth.getUser()
    const { data: workspaceId } = await supabase.rpc('current_workspace_id')
    if (!user || !workspaceId) { setError('No workspace.'); setSaving(false); return }
    const { data, error: insertError } = await supabase.from('roof_passports').insert({
      workspace_id: workspaceId,
      lead_id: lead.id,
      property_address: lead.address,
      homeowner_name: lead.name,
      manufacturer: form.manufacturer,
      material_system: form.material_system,
      color: form.color || null,
      install_date: form.install_date || null,
      status: 'active',
      created_by: user.id,
    }).select('id,property_address,homeowner_name,material_system,manufacturer,color,install_date,status').single()
    if (insertError) setError(insertError.message)
    else setPassport(data)
    setSaving(false)
  }

  const evidenceScore = Math.min(100, inspections * 25 + Math.min(photos, 12) * 5)

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24">
      <button onClick={() => router.push(`/leads/${leadId}`)} className="text-blue-600 text-sm mb-3">← Lead</button>
      <h1 className="text-2xl font-bold">Roof Passport</h1>
      <p className="text-sm text-gray-600 mb-4">Permanent property record. Not a job card. This follows the roof after payment.</p>
      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
      <div className="bg-white rounded-lg shadow p-4 mb-4">
        <p className="font-semibold">{lead?.name || 'Property'}</p>
        <p className="text-sm text-gray-500">{lead?.address}</p>
        <p className="text-sm mt-2">Evidence completeness: <strong>{evidenceScore}%</strong> · {inspections} inspection(s) · {photos} photo(s)</p>
      </div>
      {passport ? (
        <div className="bg-white rounded-lg shadow p-4 space-y-1 text-sm">
          <p>Status: {passport.status}</p>
          <p>System: {passport.manufacturer} {passport.material_system}</p>
          <p>Color: {passport.color || 'Not recorded'}</p>
          <p>Install date: {passport.install_date || 'Not recorded'}</p>
          <button onClick={() => router.push('/warranty')} className="mt-3 text-blue-600">Open warranties</button>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow p-4 space-y-2">
          <input value={form.manufacturer} onChange={(e) => setForm({ ...form, manufacturer: e.target.value })} className="w-full border rounded p-2 text-sm" placeholder="Manufacturer" />
          <input value={form.material_system} onChange={(e) => setForm({ ...form, material_system: e.target.value })} className="w-full border rounded p-2 text-sm" placeholder="System / product line" />
          <input value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="w-full border rounded p-2 text-sm" placeholder="Color" />
          <input type="date" value={form.install_date} onChange={(e) => setForm({ ...form, install_date: e.target.value })} className="w-full border rounded p-2 text-sm" />
          <button disabled={saving} onClick={() => void createPassport()} className="w-full bg-blue-600 text-white py-2 rounded font-semibold disabled:opacity-60">{saving ? 'Saving…' : 'Create Roof Passport'}</button>
        </div>
      )}
    </div>
  )
}
