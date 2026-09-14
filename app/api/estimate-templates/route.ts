import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  const { data: workspaceId } = await supabase.rpc('current_workspace_id')
  if (!workspaceId) return NextResponse.json({ error: 'No workspace is configured.' }, { status: 400 })
  const { data, error } = await supabase.from('estimate_templates').select('id,name,description,active,created_at,estimate_template_versions(id,version,status,formula_version,estimate_template_items(id,item_code,description,category,unit,default_quantity,waste_factor,sort_order))').eq('workspace_id', workspaceId).order('created_at', { ascending: false }).limit(100)
  if (error) return NextResponse.json({ error: 'Could not load estimate templates.', detail: error.message }, { status: 502 })
  return NextResponse.json({ templates: data ?? [] })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  const { data: workspaceId } = await supabase.rpc('current_workspace_id')
  if (!workspaceId) return NextResponse.json({ error: 'No workspace is configured.' }, { status: 400 })
  let body: { name?: string; description?: string; items?: Array<{ itemCode?: string; description?: string; category?: string; unit?: string; defaultQuantity?: number; wasteFactor?: number }> }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 }) }
  const name = body.name?.trim() ?? ''
  if (!name) return NextResponse.json({ error: 'Template name is required.' }, { status: 400 })
  const { data: template, error: templateError } = await supabase.from('estimate_templates').insert({ workspace_id: workspaceId, name, description: body.description?.trim() ?? null, created_by: user.id }).select('id,name,description,active').single()
  if (templateError) return NextResponse.json({ error: 'Could not create template.', detail: templateError.message }, { status: 502 })
  const { data: version, error: versionError } = await supabase.from('estimate_template_versions').insert({ template_id: template.id, version: 1, status: 'draft', formula_version: 'v1', created_by: user.id }).select('id,version,status,formula_version').single()
  if (versionError) return NextResponse.json({ error: 'Template created but version creation failed.', detail: versionError.message }, { status: 502 })
  const items = (body.items ?? []).map((item, index) => ({ template_version_id: version.id, item_code: item.itemCode?.trim() || `ITEM-${index + 1}`, description: item.description?.trim() || 'Template item', category: item.category ?? 'material', unit: item.unit ?? 'EA', default_quantity: Number(item.defaultQuantity ?? 1), waste_factor: Number(item.wasteFactor ?? 0), sort_order: index }))
  if (items.length) {
    const { error: itemError } = await supabase.from('estimate_template_items').insert(items)
    if (itemError) return NextResponse.json({ error: 'Template created but item creation failed.', detail: itemError.message }, { status: 502 })
  }
  return NextResponse.json({ template, version, status: 'draft', warning: 'Publish and price-book review are still required before external use.' }, { status: 201 })
}
