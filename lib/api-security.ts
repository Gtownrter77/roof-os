import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value)
}

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 })
}

export function unauthorized() {
  return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
}

export function forbidden() {
  return NextResponse.json({ error: 'You are not a member of this workspace.' }, { status: 403 })
}

export async function requireWorkspaceMember(
  supabase: SupabaseClient,
  userId: string,
  workspaceId: unknown,
) {
  if (!isUuid(workspaceId)) return { response: badRequest('workspaceId must be a valid workspace UUID.') }
  const { data, error } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .maybeSingle()
  if (error) return { response: NextResponse.json({ error: 'Workspace authorization could not be verified.' }, { status: 503 }) }
  if (!data) return { response: forbidden() }
  return { workspaceId }
}

export async function readJson(request: Request, maxBytes = 64 * 1024) {
  const contentLength = Number(request.headers.get('content-length') ?? 0)
  if (contentLength > maxBytes) return { error: 'Request body is too large.' as const }
  try {
    const body = await request.json()
    if (body === null || typeof body !== 'object' || Array.isArray(body)) return { error: 'JSON body must be an object.' as const }
    return { body: body as Record<string, unknown> }
  } catch {
    return { error: 'Invalid JSON body.' as const }
  }
}

export async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}, timeoutMs = 10_000) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(input, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timeout)
  }
}

export function parseProviderBody(text: string) {
  try {
    return JSON.parse(text) as unknown
  } catch {
    return { message: text.slice(0, 500) }
  }
}
