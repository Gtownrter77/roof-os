import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../lib/supabase/server'

const defaults = { price_refresh_frequency: 'weekly', default_language: 'en-US', default_zipcode: '', preferred_brands: {}, material_search_mode: 'catalog_and_retailer' }

async function context() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, user: null, workspaceId: null }
  const { data: workspaceId } = await supabase.rpc('current_workspace_id')
  return { supabase, user, workspaceId }
}

export async function GET() {
  const { supabase, user, workspaceId } = await context()
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  if (!workspaceId) return NextResponse.json({ settings: defaults, persisted: false })
  const { data, error } = await supabase.from('workspace_settings').select('*').eq('workspace_id', workspaceId).maybeSingle()
  if (error) return NextResponse.json({ error: 'Could not load workspace settings.', detail: error.message }, { status: 502 })
  return NextResponse.json({ settings: data ?? { ...defaults, workspace_id: workspaceId }, persisted: Boolean(data) })
}

export async function PUT(request: NextRequest) {
  const { supabase, user, workspaceId } = await context()
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  if (!workspaceId) return NextResponse.json({ error: 'No workspace is configured.' }, { status: 400 })
  let body: Record<string, unknown>
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 }) }
  const frequency = String(body.price_refresh_frequency ?? 'weekly')
  const language = String(body.default_language ?? 'en-US')
  const zipcode = String(body.default_zipcode ?? '').trim()
  const mode = String(body.material_search_mode ?? 'catalog_and_retailer')
  if (!['weekly', 'manual', 'disabled'].includes(frequency)) return NextResponse.json({ error: 'Invalid price refresh frequency.' }, { status: 400 })
  if (!/^[a-z]{2}(-[A-Z]{2})?$/.test(language)) return NextResponse.json({ error: 'Language must use a locale such as en-US.' }, { status: 400 })
  if (zipcode && !/^\d{5}$/.test(zipcode)) return NextResponse.json({ error: 'ZIP code must contain five digits.' }, { status: 400 })
  if (!['catalog_only', 'catalog_and_retailer'].includes(mode)) return NextResponse.json({ error: 'Invalid material search mode.' }, { status: 400 })
  const { data, error } = await supabase.from('workspace_settings').upsert({ workspace_id: workspaceId, price_refresh_frequency: frequency, default_language: language, default_zipcode: zipcode || null, preferred_brands: body.preferred_brands ?? {}, material_search_mode: mode, updated_by: user.id, updated_at: new Date().toISOString() }).select('*').single()
  if (error) return NextResponse.json({ error: 'Settings save blocked. Apply migration 019 and confirm workspace ownership.', detail: error.message }, { status: 403 })
  return NextResponse.json({ saved: true, settings: data })
}
