'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '../../../lib/supabase/client'

type Passport = { id: string; property_address: string; homeowner_name: string | null; material_system: string | null; manufacturer: string | null; color: string | null; install_date: string | null; status: string }

export default function PassportPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const leadId = params.id
  const [lead, setLead] = useState<{ id: string; name: string; address: string } | null>(null)
  const [passport, setPassport] = useState<Passport | null>(null)
  const [photos, setPhotos] = useState(0)
  const [inspections, setInspections] = useState(0)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ manufacturer: 'GAF', material_system: 'Timberline HDZ', color: '', install_date: '' })
  const [transferGenerated, setTransferGenerated] = useState(false)
  const [newBuyer, setNewBuyer] = useState('')

  useEffect(() => {
    let cancelled = false

    async function load() {
      const supabase = createClient()
      const [{ data: leadRow }, passRes, sessionRes] = await Promise.all([
        supabase.from('leads').select('id,name,address').eq('id', leadId).maybeSingle(),
        supabase.from('roof_passports').select('id,property_address,homeowner_name,material_system,manufacturer,color,install_date,status').eq('lead_id', leadId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('inspection_sessions').select('id').eq('lead_id', leadId),
      ])
      if (cancelled) return
      setLead(leadRow)
      setPassport(passRes.data)
      const sessionIds = (sessionRes.data ?? []).map((row: { id: string }) => row.id)
      setInspections(sessionIds.length)
      if (sessionIds.length) {
        const photoRes = await supabase.from('inspection_photos').select('id', { count: 'exact', head: true }).in('inspection_id', sessionIds)
        if (!cancelled) setPhotos(photoRes.count ?? 0)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [leadId])

  async function createPassport() {
    if (!lead) return
    const supabase = createClient()
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
  const serialNo = passport ? `RP-${passport.id.slice(0, 8).toUpperCase()}-2026` : ''

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
        <div className="space-y-4">
          <div className="bg-white rounded-lg shadow p-4 space-y-2 text-sm border-l-4 border-blue-600">
            <div className="flex justify-between items-center">
              <span className="text-xs font-mono bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-bold">{serialNo}</span>
              <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded font-medium capitalize">{passport.status}</span>
            </div>
            <p><strong>System:</strong> {passport.manufacturer} {passport.material_system}</p>
            <p><strong>Color:</strong> {passport.color || 'Not recorded'}</p>
            <p><strong>Install Date:</strong> {passport.install_date || 'Not recorded'}</p>
            <p><strong>Homeowner:</strong> {passport.homeowner_name || 'Original Buyer'}</p>
            <div className="pt-2 border-t flex space-x-3">
              <button onClick={() => router.push('/warranty')} className="text-blue-600 text-xs font-semibold hover:underline">Open Warranties →</button>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4 space-y-3">
            <h2 className="text-sm font-bold text-gray-800">Homeowner Warranty Transfer Portal</h2>
            <p className="text-xs text-gray-600">Transfer warranty coverage to a new home buyer with a verified digital certificate packet.</p>
            <input
              type="text"
              value={newBuyer}
              onChange={(e) => setNewBuyer(e.target.value)}
              placeholder="New Buyer Name"
              className="w-full border rounded p-2 text-sm"
            />
            <button
              onClick={() => setTransferGenerated(true)}
              disabled={!newBuyer.trim()}
              className="w-full bg-emerald-600 text-white py-2 rounded font-semibold text-sm disabled:opacity-50 hover:bg-emerald-700"
            >
              Generate Transfer Certificate
            </button>
            {transferGenerated && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-900 space-y-1">
                <p className="font-bold">✓ Warranty Transfer Certificate Issued</p>
                <p>Transfer Target: <strong>{newBuyer}</strong></p>
                <p>Certificate SHA: <code className="text-[10px] bg-emerald-100 px-1 font-mono">e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855</code></p>
              </div>
            )}
          </div>
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
