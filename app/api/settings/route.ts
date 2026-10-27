import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../lib/supabase/server'
import { readJson } from '../../../lib/api-security'
import {
  WORKSPACE_FEATURE_FLAG_KEYS,
  defaultWorkspaceSettings,
  readWorkspaceSettings,
} from '../../../lib/workspace-settings'

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
  if (!workspaceId) return NextResponse.json({ settings: defaultWorkspaceSettings(), persisted: false })
  const { data, error } = await supabase.from('workspace_settings').select('*').eq('workspace_id', workspaceId).maybeSingle()
  if (error) return NextResponse.json({ error: 'Could not load workspace settings.', detail: error.message }, { status: 502 })
  return NextResponse.json({ settings: readWorkspaceSettings(data), persisted: Boolean(data) })
}

export async function PUT(request: NextRequest) {
  const { supabase, user, workspaceId } = await context()
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  if (!workspaceId) return NextResponse.json({ error: 'No workspace is configured.' }, { status: 400 })
  const { data: isAdmin, error: roleError } = await supabase.rpc('is_workspace_admin', { target_workspace: workspaceId })
  if (roleError) return NextResponse.json({ error: 'Workspace authorization could not be verified.' }, { status: 503 })
  if (!isAdmin) return NextResponse.json({ error: 'Workspace administrator access is required to change workspace settings.' }, { status: 403 })
  const parsedBody = await readJson(request)
  if ('error' in parsedBody) return NextResponse.json({ error: parsedBody.error }, { status: parsedBody.status })
  const body = parsedBody.body as Record<string, unknown>
  const patch: Record<string, unknown> = {}

  if ('price_refresh_frequency' in body) {
    const frequency = String(body.price_refresh_frequency)
    if (!['weekly', 'manual', 'disabled'].includes(frequency)) return NextResponse.json({ error: 'Invalid price refresh frequency.' }, { status: 400 })
    patch.price_refresh_frequency = frequency
  }
  if ('default_language' in body) {
    const language = String(body.default_language)
    if (!/^[a-z]{2}(-[A-Z]{2})?$/.test(language)) return NextResponse.json({ error: 'Language must use a locale such as en-US.' }, { status: 400 })
    patch.default_language = language
  }
  if ('default_zipcode' in body) {
    const zipcode = String(body.default_zipcode ?? '').trim()
    if (zipcode && !/^\d{5}$/.test(zipcode)) return NextResponse.json({ error: 'ZIP code must contain five digits.' }, { status: 400 })
    patch.default_zipcode = zipcode || null
  }
  if ('preferred_brands' in body) {
    const brands = body.preferred_brands
    if (!brands || typeof brands !== 'object' || Array.isArray(brands)) return NextResponse.json({ error: 'Preferred brands must be a list of named brands.' }, { status: 400 })
    const entries = Object.entries(brands as Record<string, unknown>).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
    if (entries.some(([, value]) => value.length > 80)) return NextResponse.json({ error: 'Preferred brand names must be 80 characters or fewer.' }, { status: 400 })
    patch.preferred_brands = Object.fromEntries(entries)
  }
  if ('material_search_mode' in body) {
    const mode = String(body.material_search_mode)
    if (!['catalog_only', 'catalog_and_retailer'].includes(mode)) return NextResponse.json({ error: 'Invalid material search mode.' }, { status: 400 })
    patch.material_search_mode = mode
  }
  for (const flag of WORKSPACE_FEATURE_FLAG_KEYS) {
    if (!(flag in body)) continue
    if (typeof body[flag] !== 'boolean') return NextResponse.json({ error: `${flag} must be true or false.` }, { status: 400 })
    patch[flag] = body[flag]
  }

  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'No supported setting was supplied.' }, { status: 400 })

  const { data, error } = await supabase
    .from('workspace_settings')
    .upsert({ workspace_id: workspaceId, ...patch, updated_by: user.id, updated_at: new Date().toISOString() })
    .select('*')
    .single()
  if (error) return NextResponse.json({ error: 'Settings save blocked. Apply migration 019 and confirm workspace ownership.', detail: error.message }, { status: 403 })
  return NextResponse.json({ saved: true, settings: readWorkspaceSettings(data) })
}