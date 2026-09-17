import { createAdminClient } from './supabase/admin'

export function receptionistConfig() {
  const workspaceId = process.env.RECEPTIONIST_WORKSPACE_ID?.trim()
  const ownerId = process.env.RECEPTIONIST_OWNER_ID?.trim()
  const publicUrl = process.env.RECEPTIONIST_PUBLIC_URL?.trim()
  if (!workspaceId || !ownerId || !publicUrl) throw new Error('RECEPTIONIST_WORKSPACE_ID, RECEPTIONIST_OWNER_ID, and RECEPTIONIST_PUBLIC_URL are required')
  return { workspaceId, ownerId, publicUrl }
}

export async function resolveLead(input: { workspaceId: string; ownerId: string; phone: string; name?: string; address?: string }) {
  const supabase = createAdminClient()
  const normalized = input.phone.replace(/[^0-9+]/g, '')
  const { data: existing, error: lookupError } = await supabase.from('leads').select('id,name,address,phone,email,status').eq('owner_id', input.ownerId).eq('phone', normalized).limit(1).maybeSingle()
  if (lookupError) throw lookupError
  if (existing) return existing
  const { data, error } = await supabase.from('leads').insert({ owner_id: input.ownerId, name: input.name?.trim() || 'Phone lead', address: input.address?.trim() || 'Address pending', phone: normalized, source: 'ai_receptionist' }).select('id,name,address,phone,email,status').single()
  if (error) throw error
  return data
}

export async function bookAppointment(input: { workspaceId: string; leadId: string; startsAt: string; title: string; address?: string; idempotencyKey: string }) {
  const supabase = createAdminClient()
  const start = new Date(input.startsAt)
  if (Number.isNaN(start.getTime())) throw new Error('A valid appointment start time is required')
  const end = new Date(start.getTime() + 30 * 60 * 1000)
  const { data: existingEvent } = await supabase.from('receptionist_events').select('payload').eq('workspace_id', input.workspaceId).eq('event_key', input.idempotencyKey).limit(1).maybeSingle()
  if (existingEvent?.payload && typeof existingEvent.payload === 'object' && 'appointmentId' in existingEvent.payload) return existingEvent.payload
  const { data: conflicts, error: conflictError } = await supabase.from('appointments').select('id').eq('workspace_id', input.workspaceId).neq('status', 'cancelled').lt('starts_at', end.toISOString()).gt('ends_at', start.toISOString()).limit(10)
  if (conflictError) throw conflictError
  if (conflicts?.length) throw new Error('That appointment window is no longer available')
  const { data: appointment, error } = await supabase.from('appointments').insert({ workspace_id: input.workspaceId, lead_id: input.leadId, title: input.title, appointment_type: 'inspection', starts_at: start.toISOString(), ends_at: end.toISOString(), location: input.address || null, notes: 'Booked by ROOF/OS AI receptionist.', created_by: process.env.RECEPTIONIST_OWNER_ID }).select('id,title,appointment_type,starts_at,ends_at,location,status').single()
  if (error) throw error
  await supabase.from('receptionist_events').insert({ workspace_id: input.workspaceId, event_key: input.idempotencyKey, event_type: 'appointment.booked', provider: 'receptionist', payload: { appointmentId: appointment.id, leadId: input.leadId } })
  return appointment
}

export async function recordConsent(input: { workspaceId: string; leadId?: string; phone: string; channel: 'voice' | 'sms' | 'email'; state: 'granted' | 'revoked' | 'unknown'; source: string }) {
  const supabase = createAdminClient()
  const { error } = await supabase.from('receptionist_consents').insert(input)
  if (error) throw error
}
