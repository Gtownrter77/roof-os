import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const RAPIDAPI_HOST = 'real-time-home-depot-data.p.rapidapi.com'
const MONTHLY_LIMIT = 100

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const authorization = request.headers.get('authorization')
  if (!cronSecret || authorization !== `Bearer ${cronSecret}`) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const rapidApiKey = process.env.RAPIDAPI_KEY
  if (!supabaseUrl || !serviceRoleKey || !rapidApiKey) return NextResponse.json({ error: 'Weekly pricing refresh is not configured.' }, { status: 503 })

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: watchlist, error: watchlistError } = await supabase.from('retailer_price_watchlist').select('id, workspace_id, query, zipcode, store_id').eq('active', true)
  if (watchlistError) return NextResponse.json({ error: 'Could not load pricing watchlist.', detail: watchlistError.message }, { status: 502 })
  const workspaceIds = [...new Set((watchlist ?? []).map(item => item.workspace_id))]
  const { data: settings } = await supabase.from('workspace_settings').select('workspace_id,price_refresh_frequency').in('workspace_id', workspaceIds)
  const frequencyByWorkspace = new Map((settings ?? []).map(item => [item.workspace_id, item.price_refresh_frequency]))

  const month = `${new Date().toISOString().slice(0, 7)}-01`
  const results: Array<Record<string, unknown>> = []
  for (const item of watchlist ?? []) {
    const frequency = frequencyByWorkspace.get(item.workspace_id) ?? 'weekly'
    if (frequency !== 'weekly') { results.push({ watchlistId: item.id, status: frequency === 'manual' ? 'manual_only' : 'disabled' }); continue }
    const { data: cached } = await supabase.from('retailer_price_snapshots').select('id').eq('workspace_id', item.workspace_id).eq('provider', 'home_depot').eq('query', item.query).gt('expires_at', new Date().toISOString()).limit(1).maybeSingle()
    if (cached) { results.push({ watchlistId: item.id, status: 'cached' }); continue }

    const { data: reserved, error: reserveError } = await supabase.rpc('reserve_retailer_price_query_worker', { p_workspace_id: item.workspace_id, p_provider: 'home_depot', p_query_month: month, p_monthly_limit: MONTHLY_LIMIT })
    if (reserveError || !reserved) { results.push({ watchlistId: item.id, status: 'budget_exhausted' }); continue }

    const apiUrl = new URL(`https://${RAPIDAPI_HOST}/search`)
    apiUrl.searchParams.set('query', item.query)
    apiUrl.searchParams.set('page', '1')
    apiUrl.searchParams.set('items_per_page', '24')
    apiUrl.searchParams.set('sort_by', 'best_match')
    if (item.zipcode) apiUrl.searchParams.set('zipcode', item.zipcode)
    if (item.store_id) apiUrl.searchParams.set('store_id', item.store_id)
    const response = await fetch(apiUrl, { headers: { 'x-rapidapi-host': RAPIDAPI_HOST, 'x-rapidapi-key': rapidApiKey, 'content-type': 'application/json' }, cache: 'no-store' })
    const text = await response.text()
    let payload: unknown
    try { payload = JSON.parse(text) } catch { payload = { message: text.slice(0, 500) } }
    if (!response.ok) { results.push({ watchlistId: item.id, status: 'provider_error', code: response.status }); continue }

    const { error: insertError } = await supabase.from('retailer_price_snapshots').insert({ workspace_id: item.workspace_id, provider: 'home_depot', query: item.query, zipcode: item.zipcode, store_id: item.store_id, source_url: apiUrl.toString(), response: payload, expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), created_by: null })
    results.push({ watchlistId: item.id, status: insertError ? 'cache_error' : 'refreshed' })
  }

  return NextResponse.json({ provider: 'home_depot', cadence: 'weekly', refreshedAt: new Date().toISOString(), count: results.length, results })
}
