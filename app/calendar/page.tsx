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

  async function loadAppointments() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.replace('/auth/enter'); return }
    const { data, error: queryError } = await supabase.from('appointments').select('id,title,appointment_type,starts_at,ends_at,location,notes,status').gte('starts_at', new Date().toISOString()).order('starts_at', { ascending: true })
    if (queryError) setError(queryError.message)
    else setAppointments(data ?? [])
    setLoading(false)
  }

  useEffect(() => { loadAppointments() }, [router, supabase])

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
    else { setForm({ title: '', type: 'follow_up', startsAt: '', location: '', notes: '' }); await loadAppointments() }
    setSaving(false)
  }

  return <div className="space-y-4 pb-4"><header className="glass sticky top-0 z-10 rounded-xl mb-4"><div className="px-4 py-3 flex items-center"><button onClick={() => router.back()} className="mr-3 text-xl text-cyan-300">←</button><h1 className="text-xl font-bold">📅 Calendar</h1></div></header><main className="p-4"><form onSubmit={addAppointment} className="glass rounded-xl p-4 mb-5 space-y-3"><h2 className="font-semibold">Add appointment or follow-up</h2><input required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Title" className="ops-input"/><div className="flex gap-2"><select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })} className="ops-input flex-1"><option value="inspection">Inspection</option><option value="meeting">Meeting</option><option value="follow_up">Follow-up</option><option value="review">Review</option><option value="delivery">Delivery</option></select><input required type="datetime-local" value={form.startsAt} onChange={(event) => setForm({ ...form, startsAt: event.target.value })} className="ops-input flex-1"/></div><input value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} placeholder="Location or lead address" className="ops-input"/><textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Notes" className="ops-input" rows={2}/><button disabled={saving} className="ops-btn-primary w-full disabled:opacity-60">{saving ? 'Saving…' : 'Save appointment'}</button></form>{error && <p className="text-sm text-red-300 mb-3" role="alert">{error}</p>}{loading && <p className="text-sm text-slate-400">Loading appointments…</p>}{!loading && !error && appointments.length === 0 && <div className="glass rounded-xl p-6 text-center text-slate-400">No upcoming appointments. Add an inspection or follow-up above.</div>}{appointments.map((appointment) => <div key={appointment.id} className="glass rounded-xl p-3 mb-2 flex items-center justify-between gap-3"><div><p className="text-sm font-medium">{appointment.title}</p><p className="text-xs text-slate-400">{new Date(appointment.starts_at).toLocaleString()} · {appointment.location || 'No location'}</p><span className="text-xs bg-blue-100 text-cyan-200 px-2 py-0.5 rounded">{appointment.appointment_type.replace('_', ' ')}</span></div><button onClick={() => downloadCalendarEvent(appointment)} className="bg-purple-600 text-white text-xs px-3 py-1 rounded">Export .ics</button></div>)}</main><nav className="fixed bottom-0 left-0 right-0 z-30 flex justify-around border-t border-white/10 bg-[#070b14]/95 py-2 px-4 backdrop-blur lg:hidden"><button onClick={() => router.push('/')} className="text-slate-400 text-sm">🏠 Home</button><button onClick={() => router.push('/calendar')} className="text-cyan-300 text-sm">📅 Calendar</button><button onClick={() => router.push('/leads')} className="text-slate-400 text-sm">👤 Leads</button><button onClick={() => router.push('/camera')} className="text-slate-400 text-sm">📷 Camera</button></nav></div>
}
