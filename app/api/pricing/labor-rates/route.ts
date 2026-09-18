import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'
import { readJson, requireWorkspaceMember } from '../../../../lib/api-security'

const DEFAULT_RATES = { roofing: 65, siding: 55, windows: 75, doors: 85, gutters: 45, decking: 60, drywall: 40, painting: 35, electrical: 95, plumbing: 90, hvac: 100, demo: 50, cleanup: 35, inspection: 75, consulting: 120 }
type RateKey = keyof typeof DEFAULT_RATES
type TaxRates = { state: number; county: number; city: number; specialDistrict: number }

async function ownerClient() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, user: null, workspaceId: null }
  const { data: workspaceId } = await supabase.rpc('current_workspace_id')
  return { supabase, user, workspaceId }
}

export async function GET() {
  const { supabase, user, workspaceId } = await ownerClient()
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  if (!workspaceId) return NextResponse.json({ rates: DEFAULT_RATES, taxRates: { state: 0, county: 0, city: 0, specialDistrict: 0 }, localTaxRate: 0, taxSource: '', source: 'defaults', editable: false, warning: 'No workspace is configured.' })
  const membership = await requireWorkspaceMember(supabase, user.id, workspaceId)
  if (membership.response) return membership.response
  const { data: priceBook, error } = await supabase.from('price_books').select('id,name,market,source,effective_at,status,local_tax_rate,state_tax_rate,county_tax_rate,city_tax_rate,special_district_tax_rate,tax_source,price_book_items(sku,unit,unit_price,description)').eq('workspace_id', workspaceId).eq('source', 'owner-managed').in('status', ['draft', 'active']).order('effective_at', { ascending: false }).limit(1).maybeSingle()
  if (error) return NextResponse.json({ error: 'Could not load the owner-managed price book.', detail: error.message }, { status: 502 })
  const rates = { ...DEFAULT_RATES }
  for (const item of priceBook?.price_book_items ?? []) if (item.sku.startsWith('LABOR-')) rates[item.sku.slice(6) as RateKey] = Number(item.unit_price)
  const taxRates = { state: Number(priceBook?.state_tax_rate ?? 0), county: Number(priceBook?.county_tax_rate ?? 0), city: Number(priceBook?.city_tax_rate ?? 0), specialDistrict: Number(priceBook?.special_district_tax_rate ?? 0) }
  return NextResponse.json({ rates, taxRates, localTaxRate: Number(priceBook?.local_tax_rate ?? Object.values(taxRates).reduce((sum, rate) => sum + rate, 0)), taxSource: priceBook?.tax_source ?? '', priceBook, source: priceBook ? 'owner-managed' : 'defaults', editable: true })
}

export async function PUT(request: NextRequest) {
  const { supabase, user, workspaceId } = await ownerClient()
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  if (!workspaceId) return NextResponse.json({ error: 'No workspace is configured.' }, { status: 400 })
  const membership = await requireWorkspaceMember(supabase, user.id, workspaceId)
  if (membership.response) return membership.response
  const parsed = await readJson(request)
  if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const body = parsed.body as { rates?: Record<string, number>; market?: string; effectiveAt?: string; localTaxRate?: number; taxSource?: string; taxRates?: Partial<TaxRates> }
  const rates = body.rates ?? {}
  const valid = Object.entries(rates).every(([key, value]) => key in DEFAULT_RATES && Number.isFinite(Number(value)) && Number(value) >= 0)
  if (!valid) return NextResponse.json({ error: 'Rates must be non-negative numbers using approved labor categories.' }, { status: 400 })
  const taxRates: TaxRates = { state: Number(body.taxRates?.state ?? body.localTaxRate ?? 0), county: Number(body.taxRates?.county ?? 0), city: Number(body.taxRates?.city ?? 0), specialDistrict: Number(body.taxRates?.specialDistrict ?? 0) }
  const combinedTaxRate = Object.values(taxRates).reduce((sum, value) => sum + value, 0)
  if (Object.values(taxRates).some(value => !Number.isFinite(value) || value < 0) || combinedTaxRate > 100) return NextResponse.json({ error: 'Each tax rate must be non-negative and the combined rate must be 100 or less.' }, { status: 400 })
  const taxSource = typeof body.taxSource === 'string' ? body.taxSource.trim() : ''
  if (taxSource.length > 200) return NextResponse.json({ error: 'The tax jurisdiction or source must be 200 characters or fewer.' }, { status: 400 })
  const items = Object.entries(rates).map(([key, value]) => ({ sku: `LABOR-${key}`, description: `${key} labor`, unit: key === 'gutters' ? 'LF' : key === 'roofing' || key === 'siding' || key === 'decking' || key === 'drywall' || key === 'painting' ? 'SQ' : 'HR', unit_price: Number(value) }))
  const { data: priceBookId, error } = await supabase.rpc('save_owner_price_book_with_tax', { p_workspace_id: workspaceId, p_name: 'ROOF/OS Owner Labor Rates and Jurisdiction Tax', p_market: body.market ?? 'owner-defined market', p_effective_at: body.effectiveAt ?? new Date().toISOString(), p_state_tax_rate: taxRates.state, p_county_tax_rate: taxRates.county, p_city_tax_rate: taxRates.city, p_special_district_tax_rate: taxRates.specialDistrict, p_tax_source: taxSource || 'owner-entered jurisdiction rates', p_created_by: user.id, p_items: items })
  if (error) return NextResponse.json({ error: 'Price-book save blocked. Apply migration 019 and confirm Ryan is the system owner.', detail: error.message }, { status: 403 })
  return NextResponse.json({ saved: true, priceBookId, status: 'draft', taxRates, localTaxRate: combinedTaxRate, taxSource: taxSource || 'owner-entered jurisdiction rates', warning: 'This owner-managed price book remains draft until reviewed and activated.' })
}
