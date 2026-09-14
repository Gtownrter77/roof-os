import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'

const DEFAULT_RATES = { roofing: 65, siding: 55, windows: 75, doors: 85, gutters: 45, decking: 60, drywall: 40, painting: 35, electrical: 95, plumbing: 90, hvac: 100, demo: 50, cleanup: 35, inspection: 75, consulting: 120 }

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
  if (!workspaceId) return NextResponse.json({ rates: DEFAULT_RATES, source: 'defaults', editable: false, warning: 'No workspace is configured.' })
  const { data: priceBook, error } = await supabase.from('price_books').select('id,name,market,source,effective_at,status,price_book_items(sku,unit,unit_price,description)').eq('workspace_id', workspaceId).eq('source', 'owner-managed').in('status', ['draft', 'active']).order('effective_at', { ascending: false }).limit(1).maybeSingle()
  if (error) return NextResponse.json({ error: 'Could not load the owner-managed price book.', detail: error.message }, { status: 502 })
  const rates = { ...DEFAULT_RATES }
  for (const item of priceBook?.price_book_items ?? []) if (item.sku.startsWith('LABOR-')) rates[item.sku.slice(6) as keyof typeof DEFAULT_RATES] = Number(item.unit_price)
  return NextResponse.json({ rates, priceBook, source: priceBook ? 'owner-managed' : 'defaults', editable: true })
}

export async function PUT(request: NextRequest) {
  const { supabase, user, workspaceId } = await ownerClient()
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  if (!workspaceId) return NextResponse.json({ error: 'No workspace is configured.' }, { status: 400 })
  let body: { rates?: Record<string, number>; market?: string; effectiveAt?: string }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 }) }
  const rates = body.rates ?? {}
  const valid = Object.entries(rates).every(([key, value]) => key in DEFAULT_RATES && Number.isFinite(Number(value)) && Number(value) >= 0)
  if (!valid) return NextResponse.json({ error: 'Rates must be non-negative numbers using approved labor categories.' }, { status: 400 })
  const effectiveAt = body.effectiveAt ?? new Date().toISOString()
  const { data: priceBook, error: bookError } = await supabase.from('price_books').insert({ workspace_id: workspaceId, name: 'ROOF/OS Owner Labor Rates', market: body.market ?? 'owner-defined market', source: 'owner-managed', effective_at: effectiveAt, status: 'draft', created_by: user.id }).select('id').single()
  if (bookError) return NextResponse.json({ error: 'Price-book save blocked. Activate Ryan as system owner after migration 014.', detail: bookError.message }, { status: 403 })
  const items = Object.entries(rates).map(([key, value]) => ({ price_book_id: priceBook.id, sku: `LABOR-${key}`, description: `${key} labor`, unit: key === 'gutters' ? 'LF' : key === 'roofing' || key === 'siding' || key === 'decking' || key === 'drywall' || key === 'painting' ? 'SQ' : 'HR', unit_price: Number(value), source_url: 'owner-managed', captured_at: new Date().toISOString() }))
  const { error: itemError } = await supabase.from('price_book_items').insert(items)
  if (itemError) return NextResponse.json({ error: 'Price book created but labor items failed to save.', detail: itemError.message }, { status: 502 })
  return NextResponse.json({ saved: true, priceBookId: priceBook.id, status: 'draft', warning: 'This owner-managed price book remains draft until reviewed and activated.' })
}
