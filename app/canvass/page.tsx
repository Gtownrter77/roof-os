'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase/client'

type PinStatus = 'NOT_HOME' | 'INTERESTED' | 'INSPECTED' | 'DO_NOT_KNOCK' | 'LEAD_CONVERTED'

type CanvassPin = {
  id: string
  address: string
  status: PinStatus
  homeownerName?: string
  phone?: string
  notes?: string
  lat?: number
  lng?: number
  updatedAt: string
}

export default function CanvassPage() {
  const router = useRouter()
  const supabase = createClient()
  const [pins, setPins] = useState<CanvassPin[]>([
    { id: 'pin-1', address: '742 Evergreen Terrace', status: 'INTERESTED', homeownerName: 'Homer Simpson', notes: 'Hail impacts visible on eave shingles', updatedAt: '2026-10-08 14:20' },
    { id: 'pin-2', address: '744 Evergreen Terrace', status: 'NOT_HOME', notes: 'Left flyer at front door', updatedAt: '2026-10-08 14:25' },
    { id: 'pin-3', address: '746 Evergreen Terrace', status: 'DO_NOT_KNOCK', notes: 'Posted No Soliciting sign', updatedAt: '2026-10-08 14:30' },
  ])

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

  const statusColors: Record<PinStatus, string> = {
    INTERESTED: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    INSPECTED: 'bg-blue-100 text-blue-800 border-blue-300',
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
    setNotice('✓ Door knocking pin saved to local territory map.')
  }

  const convertToLead = async (pin: CanvassPin) => {
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
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
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-gradient-to-r from-blue-700 to-indigo-700 text-white shadow-lg sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center">
            <button onClick={() => router.back()} className="text-white mr-3 text-xl">←</button>
            <h1 className="text-xl font-bold">🚶 Field Canvasser & Territory Map</h1>
          </div>
          <span className="bg-emerald-400 text-black text-xs font-bold px-2.5 py-0.5 rounded uppercase">
            DOOR KNOCKING
          </span>
        </div>
      </header>

      <main className="p-4 max-w-3xl mx-auto space-y-4">
        {notice && <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 p-3 rounded-lg text-xs font-bold">{notice}</div>}
        {error && <div className="bg-red-50 border border-red-200 text-red-800 p-3 rounded-lg text-xs font-bold">{error}</div>}

        {/* Pin Entry Form */}
        <form onSubmit={addPin} className="bg-white rounded-lg shadow p-4 space-y-3 border">
          <h2 className="font-bold text-sm text-gray-800">🚪 Log Door Knocking Activity</h2>
          <input
            type="text"
            required
            placeholder="Property Address (e.g. 742 Evergreen Terrace)"
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
        <div className="bg-white rounded-lg shadow p-4 space-y-3">
          <h2 className="font-bold text-sm text-gray-800 flex justify-between items-center">
            <span>🗺️ Active Territory Pins ({pins.length})</span>
            <span className="text-xs text-gray-500 font-normal">Storm Swath Corroborated</span>
          </h2>
          <div className="space-y-2">
            {pins.map((pin) => (
              <div key={pin.id} className="p-3 border rounded-lg bg-gray-50 flex justify-between items-start text-xs border-l-4 border-blue-600">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-sm text-gray-900">{pin.address}</span>
                    <span className={`px-2 py-0.5 rounded font-bold uppercase text-[10px] border ${statusColors[pin.status]}`}>
                      {pin.status.replace('_', ' ')}
                    </span>
                  </div>
                  {pin.homeownerName && <p className="text-gray-700">Homeowner: <strong>{pin.homeownerName}</strong> {pin.phone ? `· ${pin.phone}` : ''}</p>}
                  {pin.notes && <p className="text-gray-500 italic">"{pin.notes}"</p>}
                  <p className="text-[10px] text-gray-400">Logged: {pin.updatedAt}</p>
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
