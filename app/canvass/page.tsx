'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase/client'
import { getCanvassAdvice, ObjectionType } from '../../lib/ai/canvass-mentor'

type PinStatus = 'NOT_HOME' | 'INTERESTED' | 'INSPECTED' | 'DO_NOT_KNOCK' | 'LEAD_CONVERTED'

type CanvassPin = {
  id: string
  address: string
  status: PinStatus
  homeownerName?: string
  phone?: string
  notes?: string
  updatedAt: string
}

export default function CanvassPage() {
  const router = useRouter()
  const supabase = createClient()
  const [pins, setPins] = useState<CanvassPin[]>([])

  const [form, setForm] = useState({
    address: '',
    homeownerName: '',
    phone: '',
    status: 'INTERESTED' as PinStatus,
    notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [selectedObjection, setSelectedObjection] = useState<ObjectionType>('NO_DAMAGE')
  const [showVCard, setShowVCard] = useState(false)

  const advice = getCanvassAdvice({
    address: form.address.trim(),
    objection: selectedObjection,
  })

  const statusColors: Record<PinStatus, string> = {
    INTERESTED: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    INSPECTED: 'bg-blue-100 text-cyan-200 border-blue-300',
    NOT_HOME: 'bg-amber-100 text-amber-800 border-amber-300',
    DO_NOT_KNOCK: 'bg-red-100 text-red-800 border-red-300',
    LEAD_CONVERTED: 'bg-purple-100 text-purple-800 border-purple-300',
  }

  const addPin = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.address.trim()) return
    const newPin: CanvassPin = {
      id: `pin-${Date.now()}`,
      address: form.address.trim(),
      homeownerName: form.homeownerName.trim() || undefined,
      phone: form.phone.trim() || undefined,
      status: form.status,
      notes: form.notes.trim() || undefined,
      updatedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }
    setPins([newPin, ...pins])
    setForm({ address: '', homeownerName: '', phone: '', status: 'INTERESTED', notes: '' })
    setNotice('Draft pin added for this session only. Convert it to a lead to save it to the workspace.')
  }

  const convertToLead = async (pin: CanvassPin) => {
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/enter'); return }
      const { data: workspaceId, error: workspaceError } = await supabase.rpc('current_workspace_id')
      if (workspaceError || !workspaceId) {
        setError('Active workspace is required to convert leads.')
        setSaving(false)
        return
      }

      const { data, error: insertError } = await supabase.from('leads').insert({
        name: pin.homeownerName || `Canvass Lead: ${pin.address}`,
        address: pin.address,
        phone: pin.phone || null,
        source: 'canvasser_door_knocking',
        notes: pin.notes || 'Converted directly from field door knocking pin.',
        owner_id: user.id,
        workspace_id: workspaceId,
        status: 'new',
        next_action: 'Schedule field inspection',
        next_action_owner_id: user.id,
      }).select('id').single()

      if (insertError || !data) {
        setError(insertError?.message || 'Could not convert canvass pin to lead.')
        setSaving(false)
        return
      }

      setPins(pins.map(p => p.id === pin.id ? { ...p, status: 'LEAD_CONVERTED' } : p))
      setNotice(`✓ Converted to Workspace Lead! Opening Lead #${data.id.slice(0, 8)}…`)
      setTimeout(() => router.push(`/leads/${data.id}`), 1200)
    } catch {
      setError('Failed to convert canvassing pin to workspace lead.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4 pb-4">
      <header className="glass sticky top-0 z-10 rounded-xl mb-4">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center">
            <button onClick={() => router.back()} className="mr-3 text-xl text-cyan-300">←</button>
            <h1 className="text-xl font-bold">🚶 Canvasser & Sales Script Guide</h1>
          </div>
          <button
            onClick={() => setShowVCard(!showVCard)}
            className="bg-emerald-400 text-black text-xs font-bold px-2.5 py-1 rounded uppercase hover:bg-emerald-300"
          >
            🎴 Digital VCard
          </button>
        </div>
      </header>

      <main className="p-4 max-w-3xl mx-auto space-y-4">
        {notice && <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 p-3 rounded-lg text-xs font-bold">{notice}</div>}
        {error && <div className="bg-red-400/10 border border-red-200 text-red-800 p-3 rounded-lg text-xs font-bold">{error}</div>}

        {/* Digital Business Card Modal */}
        {showVCard && (
          <div className="glass rounded-xl p-4 border-2 border-emerald-500 space-y-3 animate-fadeIn">
            <div className="flex justify-between items-start border-b pb-2">
              <div>
                <p className="font-bold text-base text-white">Business card not configured</p>
                <p className="text-xs text-slate-300">Verified company contact details have not been connected to this preview.</p>
              </div>
              <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-mono font-bold">
                Not configured
              </span>
            </div>
            <div className="text-xs text-slate-200 space-y-1">
              <p>Phone: <strong>Not configured</strong></p>
              <p>Email: <strong>Not configured</strong></p>
            </div>
            <div className="p-3 bg-white/5 border rounded text-center">
              <div className="text-4xl mb-1">📱</div>
              <p className="text-[11px] font-bold text-slate-100">Scan or Text Digital Business Card</p>
              <p className="text-[10px] text-slate-400">Add verified business details before sharing this card.</p>
            </div>
          </div>
        )}

        {/* AI Sales Mentor Panel */}
        <div className="glass rounded-xl p-4 border-l-4 border-indigo-600 space-y-3">
          <div className="flex justify-between items-center">
            <h2 className="font-bold text-sm text-white flex items-center">
              <span className="text-lg mr-1.5">🤖</span> Doorstep Opener & Objection Guide
            </h2>
            <span className="text-[10px] bg-indigo-100 text-indigo-900 font-bold px-2 py-0.5 rounded uppercase">
              GOLDEN RULE ALIGNED
            </span>
          </div>

          <div className="bg-indigo-50/60 p-3 rounded border border-indigo-100 space-y-1 text-xs">
            <p className="font-bold text-indigo-950">Suggested Doorstep Opener Script:</p>
            <p className="text-indigo-900 italic">"{advice.openerScript}"</p>
          </div>

          <div className="space-y-1 text-xs">
            <label className="font-bold text-slate-100 block">Select Homeowner Objection:</label>
            <select
              value={selectedObjection}
              onChange={(e) => setSelectedObjection(e.target.value as ObjectionType)}
              className="w-full p-2 border rounded font-semibold text-xs"
            >
              <option value="NO_DAMAGE">"I don't see any damage on my roof"</option>
              <option value="NEW_ROOF">"My roof is relatively new"</option>
              <option value="HAVE_ADJUSTER">"I already have an insurance adjuster coming out"</option>
              <option value="NO_TIME">"I don't have time right now"</option>
              <option value="SEND_EMAIL">"Just send me an email or leave a flyer"</option>
              <option value="SPOUSE">"I need to talk to my spouse first"</option>
              <option value="RATES_GO_UP">"Won't my insurance rates go up if I file a claim?"</option>
            </select>
            {advice.objectionResponse && (
              <div className="p-3 bg-amber-400/10 border border-amber-400/30 text-amber-100 rounded mt-2 font-medium">
                <p className="font-bold text-[11px] uppercase text-amber-800 mb-0.5">Recommended Counter:</p>
                <p>"{advice.objectionResponse}"</p>
              </div>
            )}
          </div>

          <div className="text-[10px] text-slate-400 border-t pt-2 space-y-1">
            <p className="font-bold text-slate-200">Soft-Metal Inspection Evidence Checklist:</p>
            <div className="flex flex-wrap gap-1">
              {advice.collateralChecklist.map((item) => (
                <span key={item} className="bg-white/10 text-slate-100 px-2 py-0.5 rounded border">{item}</span>
              ))}
            </div>
            <p className="text-cyan-200 font-semibold pt-1">{advice.goldenReportRuleNote}</p>
          </div>
        </div>

        {/* Pin Entry Form */}
        <form onSubmit={addPin} className="glass rounded-xl p-4 space-y-3 border">
          <h2 className="font-bold text-sm text-slate-100">🚪 Log Door Knocking Activity</h2>
          <input
            type="text"
            required
            placeholder="Property address"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            className="w-full p-2.5 border rounded-lg text-sm"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              placeholder="Homeowner Name (optional)"
              value={form.homeownerName}
              onChange={(e) => setForm({ ...form, homeownerName: e.target.value })}
              className="p-2.5 border rounded-lg text-sm"
            />
            <input
              type="tel"
              placeholder="Phone Number (optional)"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="p-2.5 border rounded-lg text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as PinStatus })}
              className="p-2.5 border rounded-lg text-sm font-semibold"
            >
              <option value="INTERESTED">🟢 Interested / Inspection Requested</option>
              <option value="NOT_HOME">🟡 Not Home / Left Door Hanger</option>
              <option value="INSPECTED">🔵 On-Site Inspection Completed</option>
              <option value="DO_NOT_KNOCK">🔴 Do Not Knock / No Soliciting</option>
            </select>
            <input
              type="text"
              placeholder="Notes (e.g. hail damage, roof age)"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="p-2.5 border rounded-lg text-sm"
            />
          </div>
          <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-lg text-sm">
            📍 Drop Territory Pin
          </button>
        </form>

        {/* Territory Pins List */}
        <div className="glass rounded-xl p-4 space-y-3">
          <h2 className="font-bold text-sm text-slate-100 flex justify-between items-center">
            <span>🗺️ Active Territory Pins ({pins.length})</span>
            <span className="text-xs text-slate-400 font-normal">Session-only drafts · not synced</span>
          </h2>
          <div className="space-y-2">
            {pins.length === 0 && <p className="rounded border border-dashed p-4 text-xs text-slate-400">No draft pins yet. Add an address to create a session-only draft, then convert it to a lead to save it to the workspace.</p>}
            {pins.map((pin) => (
              <div key={pin.id} className="p-3 border rounded-lg bg-white/5 flex justify-between items-start text-xs border-l-4 border-blue-600">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-sm text-white">{pin.address}</span>
                    <span className={`px-2 py-0.5 rounded font-bold uppercase text-[10px] border ${statusColors[pin.status]}`}>
                      {pin.status.replace('_', ' ')}
                    </span>
                  </div>
                  {pin.homeownerName && <p className="text-slate-200">Homeowner: <strong>{pin.homeownerName}</strong> {pin.phone ? `· ${pin.phone}` : ''}</p>}
                  {pin.notes && <p className="text-slate-400 italic">"{pin.notes}"</p>}
                  <p className="text-[10px] text-slate-400">Logged: {pin.updatedAt}</p>
                </div>

                {pin.status !== 'LEAD_CONVERTED' && pin.status !== 'DO_NOT_KNOCK' && (
                  <button
                    disabled={saving}
                    onClick={() => void convertToLead(pin)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded font-bold text-xs shrink-0 disabled:opacity-50"
                  >
                    + Convert to Lead
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
