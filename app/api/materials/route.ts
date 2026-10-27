import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../lib/supabase/server'
import { requireWorkspaceMember } from '../../../lib/api-security'
import { loadWorkspaceSettings } from '../../../lib/workspace-settings'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  const { data: workspaceId } = await supabase.rpc('current_workspace_id')
  if (!workspaceId) return NextResponse.json({ error: 'No workspace is configured.' }, { status: 400 })
  const membership = await requireWorkspaceMember(supabase, user.id, workspaceId)
  if (membership.response) return membership.response
  const settings = await loadWorkspaceSettings(supabase, workspaceId)
  const query = request.nextUrl.searchParams.get('q')?.trim() ?? ''
  const category = request.nextUrl.searchParams.get('category')?.trim()
  let builder = supabase.from('material_catalog').select('id,category,subcategory,brand,product_line,product_name,variant,unit,coverage_per_unit,color_options,search_terms').eq('active', true).order('category').order('brand').order('product_name').limit(500)
  if (category) builder = builder.eq('category', category)
  if (query) { const sanitized = query.replace(/[,\(\):%_]/g, ' ').trim().slice(0, 80); if (sanitized) { builder = builder.or(`product_name.ilike.%${sanitized}%,brand.ilike.%${sanitized}%,product_line.ilike.%${sanitized}%,variant.ilike.%${sanitized}%`); } }
  const { data, error } = await builder
  if (error) return NextResponse.json({ error: 'Could not search the material catalog.', detail: error.message }, { status: 502 })

  const preferredBrand = settings.preferred_brands.shingles?.trim() ?? ''
  const materials = (data ?? []).map((row) => ({
    ...row,
    preferred: Boolean(preferredBrand) && (row.brand ?? '').toLowerCase() === preferredBrand.toLowerCase(),
  }))
  materials.sort((left, right) => Number(right.preferred) - Number(left.preferred))

  const { data: retailerRows } = await supabase
    .from('retailer_price_snapshots')
    .select('provider')
    .eq('workspace_id', workspaceId)
    .gt('expires_at', new Date().toISOString())
    .limit(100)

  return NextResponse.json({
    source: 'catalog_metadata_only',
    materials,
    query,
    searchMode: settings.material_search_mode,
    retailerReference: {
      enabled: settings.material_search_mode === 'catalog_and_retailer',
      cachedProviders: [...new Set((retailerRows ?? []).map((row) => row.provider))],
    },
    preferredBrand: preferredBrand || null,
  })
}
