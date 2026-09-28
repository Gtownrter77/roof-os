import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../lib/supabase/server'
import { readJson } from '../../../lib/api-security'

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
  const parsedBody = await readJson(request)
  if ('error' in parsedBody) return NextResponse.json({ error: parsedBody.error }, { status: parsedBody.status })
  const body = parsedBody.body as { name?: string; description?: string; items?: Array<{ itemCode?: string; description?: string; category?: string; unit?: string; defaultQuantity?: number; wasteFactor?: number }> }
  const name = body.name?.trim() ?? ''
  if (!name || name.length > 120) return NextResponse.json({ error: 'Template name must contain 1–120 characters.' }, { status: 400 })
  if (typeof body.description === 'string' && body.description.length > 2_000) return NextResponse.json({ error: 'Template description must be 2,000 characters or fewer.' }, { status: 400 })
  const requestedItems = body.items ?? []
  if (!Array.isArray(requestedItems) || requestedItems.length > 100) return NextResponse.json({ error: 'A template may contain at most 100 items.' }, { status: 400 })
  const categories = new Set(['material', 'labor', 'allowance', 'fee', 'tax'])
  for (const [index, item] of requestedItems.entries()) {
    if (!item || typeof item !== 'object' || (item.itemCode !== undefined && typeof item.itemCode !== 'string') || (item.description !== undefined && typeof item.description !== 'string') || (item.category !== undefined && typeof item.category !== 'string') || (item.unit !== undefined && typeof item.unit !== 'string')) {
      return NextResponse.json({ error: `Template item ${index + 1} must contain valid text fields.` }, { status: 400 })
    }
    const quantity = Number(item.defaultQuantity ?? 1)
    const waste = Number(item.wasteFactor ?? 0)
    if ((item.itemCode?.length ?? 0) > 80 || (item.description?.length ?? 0) > 500 || (item.unit?.length ?? 0) > 20 || !categories.has(item.category ?? 'material') || !Number.isFinite(quantity) || quantity < 0 || quantity > 1_000_000 || !Number.isFinite(waste) || waste < 0 || waste > 10) {
      return NextResponse.json({ error: `Template item ${index + 1} contains an invalid category, field length, quantity, or waste factor.` }, { status: 400 })
    }
  }
  const { data: template, error: templateError } = await supabase.from('estimate_templates').insert({ workspace_id: workspaceId, name, description: body.description?.trim() ?? null, created_by: user.id }).select('id,name,description,active').single()
  if (templateError || !template) return NextResponse.json({ error: 'Could not create template.' }, { status: 502 })
  const { data: version, error: versionError } = await supabase.from('estimate_template_versions').insert({ template_id: template.id, version: 1, status: 'draft', formula_version: 'v1', created_by: user.id }).select('id,version,status,formula_version').single()
  if (versionError || !version) {
    await supabase.from('estimate_templates').delete().eq('id', template.id)
    return NextResponse.json({ error: 'Template creation did not complete; the incomplete record was rolled back.' }, { status: 502 })
  }
  const items = requestedItems.map((item, index) => ({ template_version_id: version.id, item_code: item.itemCode?.trim() || `ITEM-${index + 1}`, description: item.description?.trim() || 'Template item', category: item.category ?? 'material', unit: item.unit ?? 'EA', default_quantity: Number(item.defaultQuantity ?? 1), waste_factor: Number(item.wasteFactor ?? 0), sort_order: index }))
  if (items.length) {
    const { error: itemError } = await supabase.from('estimate_template_items').insert(items)
    if (itemError) {
      await supabase.from('estimate_templates').delete().eq('id', template.id)
      return NextResponse.json({ error: 'Template creation did not complete; the incomplete record was rolled back.' }, { status: 502 })
    }
  }
  return NextResponse.json({ template, version, status: 'draft', warning: 'Publish and price-book review are still required before external use.' }, { status: 201 })
}
