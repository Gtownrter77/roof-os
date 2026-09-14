import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'

const DEFAULT_RATES = { roofing: 65, siding: 55, windows: 75, doors: 85, gutters: 45, decking: 60, drywall: 40, painting: 35, electrical: 95, plumbing: 90, hvac: 100, demo: 50, cleanup: 35, inspection: 75, consulting: 120 }

type RateKey = keyof typeof DEFAULT_RATES

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
  if (!workspaceId) return NextResponse.json({ rates: DEFAULT_RATES, localTaxRate: 0, taxSource: '', source: 'defaults', editable: false, warning: 'No workspace is configured.' })
  const { data: priceBook, error } = await supabase.from('price_books').select('id,name,market,source,effective_at,status,local_tax_rate,tax_source,price_book_items(sku,unit,unit_price,description)').eq('workspace_id', workspaceId).eq('source', 'owner-managed').in('status', ['draft', 'active']).order('effective_at', { ascending: false }).limit(1).maybeSingle()
  if (error) return NextResponse.json({ error: 'Could not load the owner-managed price book.', detail: error.message }, { status: 502 })
  const rates = { ...DEFAULT_RATES }
  for (const item of priceBook?.price_book_items ?? []) if (item.sku.startsWith('LABOR-')) rates[item.sku.slice(6) as RateKey] = Number(item.unit_price)
  return NextResponse.json({ rates, localTaxRate: Number(priceBook?.local_tax_rate ?? 0), taxSource: priceBook?.tax_source ?? '', priceBook, source: priceBook ? 'owner-managed' : 'defaults', editable: true })
}

export async function PUT(request: NextRequest) {
  const { supabase, user, workspaceId } = await ownerClient()
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  if (!workspaceId) return NextResponse.json({ error: 'No workspace is configured.' }, { status: 400 })
  let body: { rates?: Record<string, number>; market?: string; effectiveAt?: string; localTaxRate?: number; taxSource?: string }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 }) }
  const rates = body.rates ?? {}
  const valid = Object.entries(rates).every(([key, value]) => key in DEFAULT_RATES && Number.isFinite(Number(value)) && Number(value) >= 0)
  if (!valid) return NextResponse.json({ error: 'Rates must be non-negative numbers using approved labor categories.' }, { status: 400 })
  const localTaxRate = Number(body.localTaxRate ?? 0)
  if (!Number.isFinite(localTaxRate) || localTaxRate < 0 || localTaxRate > 100) return NextResponse.json({ error: 'The local tax percentage must be a number from 0 to 100.' }, { status: 400 })
  const taxSource = typeof body.taxSource === 'string' ? body.taxSource.trim() : ''
  if (taxSource.length > 200) return NextResponse.json({ error: 'The tax jurisdiction or source must be 200 characters or fewer.' }, { status: 400 })
  const items = Object.entries(rates).map(([key, value]) => ({ sku: `LABOR-${key}`, description: `${key} labor`, unit: key === 'gutters' ? 'LF' : key === 'roofing' || key === 'siding' || key === 'decking' || key === 'drywall' || key === 'painting' ? 'SQ' : 'HR', unit_price: Number(value) }))
  const { data: priceBookId, error } = await supabase.rpc('save_owner_price_book', { p_workspace_id: workspaceId, p_name: 'ROOF/OS Owner Labor Rates and Local Tax', p_market: body.market ?? 'owner-defined market', p_effective_at: body.effectiveAt ?? new Date().toISOString(), p_local_tax_rate: localTaxRate, p_tax_source: taxSource || 'owner-entered local rate', p_created_by: user.id, p_items: items })
  if (error) return NextResponse.json({ error: 'Price-book save blocked. Apply migration 017 and confirm Ryan is the system owner.', detail: error.message }, { status: 403 })
  return NextResponse.json({ saved: true, priceBookId, status: 'draft', localTaxRate, taxSource: taxSource || 'owner-entered local rate', warning: 'This owner-managed price book remains draft until reviewed and activated.' })
}
