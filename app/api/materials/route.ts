import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  const query = request.nextUrl.searchParams.get('q')?.trim() ?? ''
  const category = request.nextUrl.searchParams.get('category')?.trim()
  let builder = supabase.from('material_catalog').select('id,category,subcategory,brand,product_line,product_name,variant,unit,coverage_per_unit,color_options,search_terms').eq('active', true).order('category').order('brand').order('product_name').limit(100)
  if (category) builder = builder.eq('category', category)
  if (query) builder = builder.or(`product_name.ilike.%${query}%,brand.ilike.%${query}%,product_line.ilike.%${query}%,variant.ilike.%${query}%`)
  const { data, error } = await builder
  if (error) return NextResponse.json({ error: 'Could not search the material catalog.', detail: error.message }, { status: 502 })
  return NextResponse.json({ source: 'catalog_metadata_only', materials: data ?? [], query })
}
