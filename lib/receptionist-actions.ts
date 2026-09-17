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
  const { data: appointment, error } = await supabase.rpc('book_receptionist_appointment', {
    p_workspace_id: input.workspaceId,
    p_lead_id: input.leadId,
    p_title: input.title,
    p_starts_at: start.toISOString(),
    p_location: input.address || null,
    p_created_by: process.env.RECEPTIONIST_OWNER_ID,
    p_idempotency_key: input.idempotencyKey,
  })
  if (error) throw new Error(error.code === '23P01' ? 'That appointment window is no longer available' : error.message)
  return appointment
}

export async function recordConsent(input: { workspaceId: string; leadId?: string; phone: string; channel: 'voice' | 'sms' | 'email'; state: 'granted' | 'revoked' | 'unknown'; source: string }) {
  const supabase = createAdminClient()
  const { error } = await supabase.from('receptionist_consents').insert(input)
  if (error) throw error
}
