'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '../../../lib/supabase/client'

type Passport = {
  id: string
  property_address: string
  homeowner_name: string | null
  material_system: string | null
  manufacturer: string | null
  color: string | null
  install_date: string | null
  status: string
}
type Warranty = {
  id: string
  manufacturer: string | null
  product_line: string | null
  registration_status: string
  expires_at: string | null
  missing_items: string | null
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'Not recorded'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString()
}

export default function PassportPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = createClient()
  const leadId = params.id
  const [lead, setLead] = useState<{ id: string; name: string; address: string } | null>(null)
  const [passport, setPassport] = useState<Passport | null>(null)
  const [warranty, setWarranty] = useState<Warranty | null>(null)
  const [photos, setPhotos] = useState(0)
  const [inspections, setInspections] = useState(0)
  const [lastInspectionAt, setLastInspectionAt] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ manufacturer: 'GAF', material_system: 'Timberline HDZ', color: '', install_date: '' })

  useEffect(() => {
    async function load() {
      setError('')
      const [{ data: leadRow }, passRes, sessionRes, warrantyRes] = await Promise.all([
        supabase.from('leads').select('id,name,address').eq('id', leadId).maybeSingle(),
        supabase.from('roof_passports').select('id,property_address,homeowner_name,material_system,manufacturer,color,install_date,status').eq('lead_id', leadId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('inspection_sessions').select('id,created_at').eq('lead_id', leadId).order('created_at', { ascending: false }),
        supabase.from('warranties').select('id,manufacturer,product_line,registration_status,expires_at,missing_items').eq('lead_id', leadId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      ])
      if (!leadRow) {
        setError('Property record not found in the active workspace.')
        return
      }
      setLead(leadRow)
      setPassport(passRes.data)
      setWarranty(warrantyRes.data)
      const sessions = sessionRes.data ?? []
      setInspections(sessions.length)
      setLastInspectionAt(sessions[0]?.created_at ?? null)
      if (sessions.length) {
        const sessionIds = sessions.map((row: { id: string }) => row.id)
        const photoRes = await supabase.from('inspection_photos').select('id', { count: 'exact', head: true }).in('inspection_id', sessionIds)
        setPhotos(photoRes.count ?? 0)
      } else {
        setPhotos(0)
      }
    }
    void load()
  }, [leadId, supabase])

  async function createPassport() {
    if (!lead) return
    setSaving(true)
    setError('')
    const { data: { user } } = await supabase.auth.getUser()
    const { data: workspaceId } = await supabase.rpc('current_workspace_id')
    if (!user || !workspaceId) {
      setError('No active workspace is available.')
      setSaving(false)
      return
    }
    const { data, error: insertError } = await supabase.from('roof_passports').insert({
      workspace_id: workspaceId,
      lead_id: lead.id,
      property_address: lead.address,
      homeowner_name: lead.name,
      manufacturer: form.manufacturer.trim() || null,
      material_system: form.material_system.trim() || null,
      color: form.color.trim() || null,
      install_date: form.install_date || null,
      status: 'active',
      created_by: user.id,
    }).select('id,property_address,homeowner_name,material_system,manufacturer,color,install_date,status').single()
    if (insertError) setError(insertError.message)
    else setPassport(data)
    setSaving(false)
  }

  const evidenceActivityScore = Math.min(100, inspections * 25 + Math.min(photos, 12) * 5)
  const warrantyState = warranty?.registration_status?.replaceAll('_', ' ') ?? 'No warranty record'
  const passportLabel = passport?.status?.replaceAll('_', ' ') ?? 'Not created'

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24">
      <div className="print:hidden flex items-center justify-between mb-3">
        <button onClick={() => router.push(`/leads/${leadId}`)} className="text-blue-600 text-sm">← Lead</button>
        <button onClick={() => window.print()} className="text-sm border rounded px-3 py-1 bg-white">Print snapshot</button>
      </div>

      <div id="roof-passport" className="max-w-3xl mx-auto">
        <div className="mb-4">
          <p className="text-xs font-semibold tracking-wide text-blue-700 uppercase">ROOF/OS Permanent Property Record</p>
          <h1 className="text-2xl font-bold">Roof Passport</h1>
          <p className="text-sm text-gray-600">A property-centered record that can outlive a single roofing job.</p>
        </div>

        {error && <p className="text-sm text-red-600 mb-3" role="alert">{error}</p>}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <section className="bg-white rounded-lg shadow p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Property</p>
            <p className="font-semibold mt-1">{lead?.name || 'Property'}</p>
            <p className="text-sm text-gray-600">{lead?.address || 'Address not recorded'}</p>
          </section>
          <section className="bg-white rounded-lg shadow p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Passport status</p>
            <p className="font-semibold mt-1 capitalize">{passportLabel}</p>
            <p className="text-xs text-gray-500 mt-1">Record ID: {passport?.id || 'Not created'}</p>
          </section>
        </div>

        {passport ? (
          <>
            <section className="bg-white rounded-lg shadow p-4 mb-4">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                  <h2 className="font-semibold">Roof system</h2>
                  <p className="text-xs text-gray-500">Owner-entered property record</p>
                </div>
                <span className="text-xs rounded-full bg-blue-50 text-blue-700 px-2 py-1 capitalize">{passport.status}</span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-gray-500 block">Manufacturer</span>{passport.manufacturer || 'Not recorded'}</div>
                <div><span className="text-gray-500 block">System</span>{passport.material_system || 'Not recorded'}</div>
                <div><span className="text-gray-500 block">Color</span>{passport.color || 'Not recorded'}</div>
                <div><span className="text-gray-500 block">Install date</span>{formatDate(passport.install_date)}</div>
              </div>
            </section>

            <section className="bg-white rounded-lg shadow p-4 mb-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="font-semibold">Evidence snapshot</h2>
                  <p className="text-xs text-gray-500">Activity counts, not a certified inspection score</p>
                </div>
                <span className="text-2xl font-bold">{evidenceActivityScore}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded bg-gray-50 p-3"><p className="text-lg font-semibold">{inspections}</p><p className="text-xs text-gray-500">Inspections</p></div>
                <div className="rounded bg-gray-50 p-3"><p className="text-lg font-semibold">{photos}</p><p className="text-xs text-gray-500">Photos</p></div>
                <div className="rounded bg-gray-50 p-3"><p className="text-xs font-semibold">{formatDate(lastInspectionAt)}</p><p className="text-xs text-gray-500">Last inspection</p></div>
              </div>
              <p className="text-xs text-gray-500 mt-3">The snapshot does not certify roof condition, measurements, storm damage, or code compliance.</p>
            </section>

            <section className="bg-white rounded-lg shadow p-4 mb-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-semibold">Warranty record</h2>
                  <p className="text-xs text-gray-500">Linked to this property's lead</p>
                </div>
                <span className="text-xs rounded-full bg-gray-100 px-2 py-1 capitalize">{warrantyState}</span>
              </div>
              {warranty ? (
                <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-gray-500 block">Manufacturer</span>{warranty.manufacturer || 'Not recorded'}</div>
                  <div><span className="text-gray-500 block">Product line</span>{warranty.product_line || 'Not recorded'}</div>
                  <div><span className="text-gray-500 block">Expiration</span>{formatDate(warranty.expires_at)}</div>
                  <div><span className="text-gray-500 block">Missing items</span>{warranty.missing_items || 'None recorded'}</div>
                </div>
              ) : (
                <p className="text-sm text-gray-600 mt-3">No warranty record is linked yet.</p>
              )}
              <button onClick={() => router.push('/warranty')} className="mt-3 text-blue-600 text-sm">Open warranty records →</button>
            </section>
          </>
        ) : (
          <section className="bg-white rounded-lg shadow p-4 space-y-2">
            <h2 className="font-semibold">Create permanent property record</h2>
            <p className="text-xs text-gray-500">These fields become the starting property record. Unknown values can remain blank.</p>
            <input value={form.manufacturer} onChange={(e) => setForm({ ...form, manufacturer: e.target.value })} className="w-full border rounded p-2 text-sm" placeholder="Manufacturer" />
            <input value={form.material_system} onChange={(e) => setForm({ ...form, material_system: e.target.value })} className="w-full border rounded p-2 text-sm" placeholder="System / product line" />
            <input value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="w-full border rounded p-2 text-sm" placeholder="Color" />
            <input type="date" value={form.install_date} onChange={(e) => setForm({ ...form, install_date: e.target.value })} className="w-full border rounded p-2 text-sm" />
            <button disabled={saving} onClick={() => void createPassport()} className="w-full bg-blue-600 text-white py-2 rounded font-semibold disabled:opacity-60">{saving ? 'Saving…' : 'Create Roof Passport'}</button>
          </section>
        )}
      </div>
    </div>
  )
}