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
  public_shared: boolean
  public_token: string
}

const PASSPORT_FIELDS = 'id,property_address,homeowner_name,material_system,manufacturer,color,install_date,status,public_shared,public_token'

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
  const [shareBusy, setShareBusy] = useState(false)
  const [shareNote, setShareNote] = useState('')
  const [shareUrl, setShareUrl] = useState('')
  const [form, setForm] = useState({ manufacturer: 'GAF', material_system: 'Timberline HDZ', color: '', install_date: '' })

  useEffect(() => {
    let cancelled = false

    async function load() {
      const supabase = createClient()
      const [{ data: leadRow }, passRes, sessionRes] = await Promise.all([
        supabase.from('leads').select('id,name,address').eq('id', leadId).maybeSingle(),
        supabase.from('roof_passports').select(PASSPORT_FIELDS).eq('lead_id', leadId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
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

  useEffect(() => {
    setShareUrl(passport?.public_shared && passport.public_token
      ? `${window.location.origin}/passport/share/${passport.public_token}`
      : '')
  }, [passport])

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
    }).select(PASSPORT_FIELDS).single()
    if (insertError) setError(insertError.message)
    else setPassport(data)
    setSaving(false)
  }

  async function setSharing(next: boolean) {
    if (!passport) return
    setShareBusy(true); setShareNote('')
    try {
      const res = await fetch(`/api/passport/${passport.id}/share`, { method: next ? 'POST' : 'DELETE' })
      const body = await res.json() as { shared?: boolean; token?: string; error?: string }
      if (!res.ok) {
        setShareNote(body.error ?? 'Could not update sharing.')
        return
      }
      setPassport({ ...passport, public_shared: next, public_token: body.token ?? passport.public_token })
      setShareNote(next ? 'Homeowner link published.' : 'Homeowner link revoked.')
    } catch {
      setShareNote('Could not update sharing.')
    } finally {
      setShareBusy(false)
    }
  }

  async function copyLink() {
    if (!shareUrl) return
    try {
      await navigator.clipboard.writeText(shareUrl)
      setShareNote('Link copied.')
    } catch {
      setShareNote(shareUrl)
    }
  }

  const evidenceScore = Math.min(100, inspections * 25 + Math.min(photos, 12) * 5)

  return (
    <div className="space-y-4 p-1 pb-4">
      <button onClick={() => router.push(`/leads/${leadId}`)} className="text-cyan-300 text-sm mb-3">← Lead</button>
      <h1 className="text-2xl font-bold">Roof Passport</h1>
      <p className="text-sm text-slate-300 mb-4">Permanent property record. Not a job card. This follows the roof after payment.</p>
      {error && <p className="text-sm text-red-300 mb-3">{error}</p>}
      <div className="glass rounded-xl p-4 mb-4">
        <p className="font-semibold">{lead?.name || 'Property'}</p>
        <p className="text-sm text-slate-400">{lead?.address}</p>
        <p className="text-sm mt-2">Evidence completeness: <strong>{evidenceScore}%</strong> · {inspections} inspection(s) · {photos} photo(s)</p>
      </div>
      {passport ? (
        <div className="glass rounded-xl p-4 space-y-1 text-sm">
          <p>Status: {passport.status}</p>
          <p>System: {passport.manufacturer} {passport.material_system}</p>
          <p>Color: {passport.color || 'Not recorded'}</p>
          <p>Install date: {passport.install_date || 'Not recorded'}</p>
          <button onClick={() => router.push('/warranty')} className="mt-3 text-cyan-300">Open warranties</button>

          <div className="mt-4 space-y-2 border-t border-white/10 pt-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">Homeowner link</p>
            {passport.public_shared ? (
              <>
                <input readOnly value={shareUrl} aria-label="Public passport link" className="w-full rounded border p-2 text-xs" />
                <div className="flex gap-2">
                  <button onClick={() => void copyLink()} className="ops-btn-primary flex-1">Copy link</button>
                  <button disabled={shareBusy} onClick={() => void setSharing(false)} className="ops-btn flex-1 disabled:opacity-60">Unpublish</button>
                </div>
              </>
            ) : (
              <button disabled={shareBusy} onClick={() => void setSharing(true)} className="ops-btn-primary w-full disabled:opacity-60">
                {shareBusy ? 'Publishing…' : 'Publish homeowner link'}
              </button>
            )}
            {shareNote && <p className="text-xs text-slate-300" role="status">{shareNote}</p>}
            <p className="text-[11px] text-slate-500">Anyone with this link can view the property address and roof system. No pricing, photos, or customer data is exposed.</p>
          </div>
        </div>
      ) : (
        <div className="glass rounded-xl p-4 space-y-2">
          <input value={form.manufacturer} onChange={(e) => setForm({ ...form, manufacturer: e.target.value })} className="w-full border rounded p-2 text-sm" placeholder="Manufacturer" />
          <input value={form.material_system} onChange={(e) => setForm({ ...form, material_system: e.target.value })} className="w-full border rounded p-2 text-sm" placeholder="System / product line" />
          <input value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="w-full border rounded p-2 text-sm" placeholder="Color" />
          <input type="date" value={form.install_date} onChange={(e) => setForm({ ...form, install_date: e.target.value })} className="w-full border rounded p-2 text-sm" />
          <button disabled={saving} onClick={() => void createPassport()} className="ops-btn-primary w-full disabled:opacity-60">{saving ? 'Saving…' : 'Create Roof Passport'}</button>
        </div>
      )}
    </div>
  )
}
