'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase/client'

type Appointment = { id: string; title: string; appointment_type: string; starts_at: string; ends_at: string; location: string | null; notes: string | null; status: string }

function downloadCalendarEvent(appointment: Appointment) {
  const format = (date: Date) => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const escape = (value: string) => value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, '\\$&')
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//ROOF OS//Appointments//EN', 'BEGIN:VEVENT', `UID:${appointment.id}@roof-os`, `DTSTAMP:${format(new Date())}`, `DTSTART:${format(new Date(appointment.starts_at))}`, `DTEND:${format(new Date(appointment.ends_at))}`, `SUMMARY:${escape(appointment.title)}`, `LOCATION:${escape(appointment.location ?? '')}`, `DESCRIPTION:${escape(appointment.notes ?? '')}`, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n')
  const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `${appointment.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.ics`
  link.click()
  URL.revokeObjectURL(url)
}

export default function CalendarPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [form, setForm] = useState({ title: '', type: 'follow_up', startsAt: '', location: '', notes: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [conflictWarning, setConflictWarning] = useState('')

  async function loadAppointments() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.replace('/auth/login'); return }
    const { data, error: queryError } = await supabase.from('appointments').select('id,title,appointment_type,starts_at,ends_at,location,notes,status').gte('starts_at', new Date().toISOString()).order('starts_at', { ascending: true })
    if (queryError) setError(queryError.message)
    else setAppointments(data ?? [])
    setLoading(false)
  }

  useEffect(() => { loadAppointments() }, [router, supabase])

  const checkConflict = (startTimeStr: string) => {
    if (!startTimeStr) { setConflictWarning(''); return }
    const proposedStart = new Date(startTimeStr).getTime()
    const proposedEnd = proposedStart + 30 * 60 * 1000

    const conflict = appointments.find(app => {
      const appStart = new Date(app.starts_at).getTime()
      const appEnd = new Date(app.ends_at).getTime()
      return (proposedStart < appEnd && proposedEnd > appStart)
    })

    if (conflict) {
      setConflictWarning(`⚠️ Schedule Conflict Detected: Overlaps with "${conflict.title}" (${new Date(conflict.starts_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`)
    } else {
      setConflictWarning('✓ Slot Available: No scheduling conflicts detected.')
    }
  }

  async function addAppointment(event: React.FormEvent) {
    event.preventDefault()
    if (!form.title || !form.startsAt) return
    setSaving(true); setError('')
    const { data: { user } } = await supabase.auth.getUser()
    const { data: workspaceId } = await supabase.rpc('current_workspace_id')
    if (!user || !workspaceId) { setError('No workspace is available for this account.'); setSaving(false); return }
    const start = new Date(form.startsAt)
    const end = new Date(start.getTime() + 30 * 60 * 1000)
    const { error: insertError } = await supabase.from('appointments').insert({ workspace_id: workspaceId, title: form.title, appointment_type: form.type, starts_at: start.toISOString(), ends_at: end.toISOString(), location: form.location || null, notes: form.notes || null, created_by: user.id })
    if (insertError) setError(insertError.message)
    else { setForm({ title: '', type: 'follow_up', startsAt: '', location: '', notes: '' }); setConflictWarning(''); await loadAppointments() }
    setSaving(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-blue-600 text-white shadow-lg sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center">
          <button onClick={() => router.back()} className="text-white mr-3 text-xl">←</button>
          <h1 className="text-xl font-bold">📅 Calendar & Inspector Dispatch</h1>
        </div>
      </header>
      <main className="p-4">
        <form onSubmit={addAppointment} className="bg-white rounded-lg shadow p-4 mb-5 space-y-3">
          <h2 className="font-semibold text-gray-800">Schedule Appointment or Inspection</h2>
          <input required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Title / Customer Name" className="w-full p-2 border rounded text-sm"/>
          <div className="flex gap-2">
            <select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })} className="p-2 border rounded flex-1 text-sm">
              <option value="inspection">Roof Inspection</option>
              <option value="meeting">Adjuster Meeting</option>
              <option value="follow_up">Follow-up</option>
              <option value="review">Report Review</option>
              <option value="delivery">Material Delivery</option>
            </select>
            <input
              required
              type="datetime-local"
              value={form.startsAt}
              onChange={(event) => {
                setForm({ ...form, startsAt: event.target.value })
                checkConflict(event.target.value)
              }}
              className="p-2 border rounded flex-1 text-sm"
            />
          </div>

          {conflictWarning && (
            <p className={`p-2 rounded text-xs font-semibold ${conflictWarning.startsWith('⚠️') ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-emerald-100 text-emerald-900 border border-emerald-300'}`}>
              {conflictWarning}
            </p>
          )}

          <input value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} placeholder="Job location / property address" className="w-full p-2 border rounded text-sm"/>
          <textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Inspector notes or access instructions" className="w-full p-2 border rounded text-sm" rows={2}/>
          <button disabled={saving} className="w-full bg-blue-600 text-white py-2 rounded font-semibold text-sm disabled:opacity-60 hover:bg-blue-700">
            {saving ? 'Saving…' : 'Save appointment'}
          </button>
        </form>

        {error && <p className="text-sm text-red-600 mb-3" role="alert">{error}</p>}
        {loading && <p className="text-sm text-gray-500">Loading appointments…</p>}
        {!loading && !error && appointments.length === 0 && <div className="bg-white rounded-lg shadow p-6 text-center text-gray-500 text-sm">No upcoming appointments. Add an inspection or follow-up above.</div>}

        <div className="space-y-2">
          {appointments.map((appointment) => (
            <div key={appointment.id} className="bg-white rounded-lg shadow p-3 flex items-center justify-between gap-3 border-l-4 border-blue-600">
              <div>
                <p className="text-sm font-bold text-gray-900">{appointment.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">{new Date(appointment.starts_at).toLocaleString()} · {appointment.location || 'No location'}</p>
                <span className="text-[10px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-bold uppercase mt-1 inline-block">{appointment.appointment_type.replace('_', ' ')}</span>
              </div>
              <button onClick={() => downloadCalendarEvent(appointment)} className="bg-purple-600 hover:bg-purple-700 text-white text-xs px-3 py-1.5 rounded font-semibold">
                Export .ics
              </button>
            </div>
          ))}
        </div>
      </main>
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around py-2 px-4">
        <button onClick={() => router.push('/')} className="text-gray-400 text-sm">🏠 Home</button>
        <button onClick={() => router.push('/calendar')} className="text-blue-600 text-sm font-bold">📅 Calendar</button>
        <button onClick={() => router.push('/leads')} className="text-gray-400 text-sm">👤 Leads</button>
        <button onClick={() => router.push('/camera')} className="text-gray-400 text-sm">📷 Camera</button>
      </nav>
    </div>
  )
}
