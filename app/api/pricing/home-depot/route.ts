import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'

const RAPIDAPI_HOST = 'real-time-home-depot-data.p.rapidapi.com'
const MONTHLY_LIMIT = 100

export async function GET(request: NextRequest) {
  const rapidApiKey = process.env.RAPIDAPI_KEY
  if (!rapidApiKey) return NextResponse.json({ error: 'Home Depot pricing integration is not configured.' }, { status: 503 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })

  const params = request.nextUrl.searchParams
  const workspaceId = params.get('workspaceId')
  const query = params.get('query')?.trim()
  const zipcode = params.get('zipcode')?.trim() || undefined
  const storeId = params.get('storeId')?.trim() || undefined
  if (!workspaceId || !/^[0-9a-f-]{36}$/i.test(workspaceId)) return NextResponse.json({ error: 'workspaceId must be a valid workspace UUID.' }, { status: 400 })
  if (!query || query.length > 120) return NextResponse.json({ error: 'query is required and must be 120 characters or fewer.' }, { status: 400 })
  if (zipcode && !/^\d{5}$/.test(zipcode)) return NextResponse.json({ error: 'zipcode must be five digits.' }, { status: 400 })
  if (storeId && !/^\d{1,12}$/.test(storeId)) return NextResponse.json({ error: 'storeId must contain digits only.' }, { status: 400 })

  const { data: cached } = await supabase.from('retailer_price_snapshots').select('response, retrieved_at, expires_at, source_url').eq('workspace_id', workspaceId).eq('provider', 'home_depot').eq('query', query).gt('expires_at', new Date().toISOString()).order('retrieved_at', { ascending: false }).limit(1).maybeSingle()
  if (cached) return NextResponse.json({ provider: 'home_depot', cached: true, source: 'retailer_reference_only', ...cached })

  const month = new Date().toISOString().slice(0, 10).slice(0, 7) + '-01'
  const { data: reserved, error: reserveError } = await supabase.rpc('reserve_retailer_price_query', { p_workspace_id: workspaceId, p_provider: 'home_depot', p_query_month: month, p_monthly_limit: MONTHLY_LIMIT })
  if (reserveError) return NextResponse.json({ error: 'Could not reserve the monthly pricing request.', detail: reserveError.message }, { status: 502 })
  if (!reserved) return NextResponse.json({ error: 'Monthly Home Depot inquiry limit reached.', limit: MONTHLY_LIMIT }, { status: 429 })

  const apiUrl = new URL(`https://${RAPIDAPI_HOST}/search`)
  apiUrl.searchParams.set('query', query)
  apiUrl.searchParams.set('page', '1')
  apiUrl.searchParams.set('items_per_page', '24')
  apiUrl.searchParams.set('sort_by', 'best_match')
  if (zipcode) apiUrl.searchParams.set('zipcode', zipcode)
  if (storeId) apiUrl.searchParams.set('store_id', storeId)

  const response = await fetch(apiUrl, { headers: { 'x-rapidapi-host': RAPIDAPI_HOST, 'x-rapidapi-key': rapidApiKey, 'content-type': 'application/json' }, cache: 'no-store' })
  const text = await response.text()
  let result: unknown
  try { result = JSON.parse(text) } catch { result = { message: text.slice(0, 500) } }
  if (!response.ok) return NextResponse.json({ error: 'Home Depot pricing provider failed.', provider: result }, { status: 502 })

  const sourceUrl = apiUrl.toString()
  const { error: cacheError } = await supabase.from('retailer_price_snapshots').insert({ workspace_id: workspaceId, provider: 'home_depot', query, zipcode: zipcode ?? null, store_id: storeId ?? null, source_url: sourceUrl, response: result, expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), created_by: user.id })
  if (cacheError) return NextResponse.json({ error: 'Price was retrieved but could not be cached in the workspace ledger.', detail: cacheError.message }, { status: 502 })
  return NextResponse.json({ provider: 'home_depot', cached: false, source: 'retailer_reference_only', retrieved_at: new Date().toISOString(), response: result })
}
