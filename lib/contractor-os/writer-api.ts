import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '../supabase/server'
import { isUuid, requireWorkspaceMember } from '../api-security'

export async function getContractorContext() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, user: null, workspaceId: null, response: NextResponse.json({ error: 'Authentication required.' }, { status: 401 }) }
  const { data: workspaceId, error } = await supabase.rpc('current_workspace_id')
  if (error || !isUuid(workspaceId)) {
    return { supabase, user, workspaceId: null, response: NextResponse.json({ error: 'No active workspace is configured.' }, { status: 400 }) }
  }
  const membership = await requireWorkspaceMember(supabase, user.id, workspaceId)
  if ('response' in membership) return { supabase, user, workspaceId, response: membership.response }
  return { supabase, user, workspaceId, response: null }
}

export function rpcFailure(error: { message?: string } | null, fallback: string) {
  const message = (error?.message ?? '').toLowerCase()
  if (message.includes('authentication required')) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  if (message.includes('not found')) return NextResponse.json({ error: fallback.includes('review') ? fallback : 'Record not found.' }, { status: 404 })
  if (message.includes('administrator') || message.includes('membership is required') || message.includes('outside the active workspace')) {
    return NextResponse.json({ error: error?.message ?? 'Workspace authorization is required.' }, { status: 403 })
  }
  if (message.includes('immutable') || message.includes('terminal') || message.includes('must be reviewed') || message.includes('already exists')) {
    return NextResponse.json({ error: error?.message ?? 'The requested state transition is not allowed.' }, { status: 409 })
  }
  if (message.includes('required') || message.includes('invalid') || message.includes('must be') || message.includes('expiry')) {
    return NextResponse.json({ error: error?.message ?? 'The request is invalid.' }, { status: 400 })
  }
  return NextResponse.json({ error: fallback }, { status: 502 })
}

export function objectOr(value: unknown, fallback: Record<string, unknown> = {}) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : fallback
}

export function arrayOr(value: unknown) {
  return Array.isArray(value) ? value : []
}

export function text(value: unknown, max = 2000) {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

export { isUuid }
export type ContractorSupabase = SupabaseClient
