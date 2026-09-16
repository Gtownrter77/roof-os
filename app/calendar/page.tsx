'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase/client'

type Appointment = { id: string; title: string; appointment_type: string; starts_at: string; ends_at: string; location: string | null; notes: string | null; status: string; lead_id: string | null }
type LeadOption = { id: string; name: string; address: string }

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
  const supabase = createClient()
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [leads, setLeads] = useState<LeadOption[]>([])
  const [form, setForm] = useState({ title: '', type: 'follow_up', startsAt: '', location: '', notes: '', leadId: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function loadAppointments() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.replace('/auth/login'); return }
    const lookback = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const [{ data, error: queryError }, leadRes] = await Promise.all([
      supabase.from('appointments').select('id,title,appointment_type,starts_at,ends_at,location,notes,status,lead_id').gte('starts_at', lookback).order('starts_at', { ascending: true }),
      supabase.from('leads').select('id,name,address').order('created_at', { ascending: false }).limit(100),
    ])
    if (queryError) setError(queryError.message)
    else setAppointments(data ?? [])
    setLeads(leadRes.data ?? [])
    setLoading(false)
  }

  useEffect(() => { void loadAppointments() }, [router, supabase])

  async function addAppointment(event: React.FormEvent) {
    event.preventDefault()
    if (!form.title || !form.startsAt) return
    setSaving(true); setError('')
    const { data: { user } } = await supabase.auth.getUser()
    const { data: workspaceId } = await supabase.rpc('current_workspace_id')
    if (!user || !workspaceId) { setError('No workspace is available for this account.'); setSaving(false); return }
    const start = new Date(form.startsAt)
    const end = new Date(start.getTime() + 30 * 60 * 1000)
    const selectedLead = leads.find((lead) => lead.id === form.leadId)
    const { error: insertError } = await supabase.from('appointments').insert({
      workspace_id: workspaceId,
      title: form.title,
      appointment_type: form.type,
      starts_at: start.toISOString(),
      ends_at: end.toISOString(),
      location: form.location || selectedLead?.address || null,
      notes: form.notes || null,
      created_by: user.id,
      lead_id: form.leadId || null,
    })
    if (insertError) setError(insertError.message)
    else {
      if (form.leadId && form.type === 'inspection') {
        await supabase.from('leads').update({ status: 'inspection_scheduled', updated_at: new Date().toISOString() }).eq('id', form.leadId)
      }
      setForm({ title: '', type: 'follow_up', startsAt: '', location: '', notes: '', leadId: '' })
      await loadAppointments()
    }
    setSaving(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <header className="bg-blue-600 text-white shadow-lg sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center">
          <button onClick={() => router.back()} className="text-white mr-3 text-xl">←</button>
          <h1 className="text-xl font-bold">Calendar</h1>
        </div>
      </header>
      <main className="p-4">
        <form onSubmit={addAppointment} className="bg-white rounded-lg shadow p-4 mb-5 space-y-3">
          <h2 className="font-semibold">Add appointment or follow-up</h2>
          <input required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Title" className="w-full p-2 border rounded" />
          <select value={form.leadId} onChange={(event) => {
            const leadId = event.target.value
            const selected = leads.find((lead) => lead.id === leadId)
            setForm({ ...form, leadId, location: selected?.address || form.location, title: form.title || (selected ? `${form.type.replace('_', ' ')}: ${selected.name}` : form.title) })
          }} className="w-full p-2 border rounded">
            <option value="">Unlinked appointment</option>
            {leads.map((lead) => <option key={lead.id} value={lead.id}>{lead.name}</option>)}
          </select>
          <div className="flex gap-2">
            <select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })} className="p-2 border rounded flex-1">
              <option value="inspection">Inspection</option>
              <option value="meeting">Meeting</option>
              <option value="follow_up">Follow-up</option>
              <option value="review">Review</option>
              <option value="delivery">Delivery</option>
            </select>
            <input required type="datetime-local" value={form.startsAt} onChange={(event) => setForm({ ...form, startsAt: event.target.value })} className="p-2 border rounded flex-1" />
          </div>
          <input value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} placeholder="Location or lead address" className="w-full p-2 border rounded" />
          <button disabled={saving} className="w-full bg-blue-600 text-white py-2 rounded font-semibold disabled:opacity-60">{saving ? 'Saving…' : 'Save appointment'}</button>
        </form>
        {error && <p className="text-sm text-red-600 mb-3" role="alert">{error}</p>}
        {appointments.map((appointment) => (
          <div key={appointment.id} className="bg-white rounded-lg shadow p-3 mb-2 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">{appointment.title}</p>
              <p className="text-xs text-gray-500">{new Date(appointment.starts_at).toLocaleString()} · {appointment.location || 'No location'}</p>
              {appointment.lead_id && <button onClick={() => router.push(`/leads/${appointment.lead_id}`)} className="text-xs text-blue-600">Open lead</button>}
            </div>
            <button onClick={() => downloadCalendarEvent(appointment)} className="bg-purple-600 text-white text-xs px-3 py-1 rounded">Export .ics</button>
          </div>
        ))}
      </main>
    </div>
  )
}
