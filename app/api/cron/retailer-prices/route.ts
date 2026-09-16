import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getLowesAccessToken, LOWES_PRODUCT_SEARCH_URL } from '../../../../lib/lowes'

const HOME_DEPOT_HOST = 'real-time-home-depot-data.p.rapidapi.com'
const MONTHLY_LIMIT = 100

type WatchlistItem = { id: string; workspace_id: string; provider: 'home_depot' | 'lowes'; query: string; zipcode: string | null; store_id: string | null }

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const authorization = request.headers.get('authorization')
  if (!cronSecret || authorization !== `Bearer ${cronSecret}`) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const rapidApiKey = process.env.RAPIDAPI_KEY
  if (!supabaseUrl || !serviceRoleKey) return NextResponse.json({ error: 'Weekly pricing refresh is not configured.' }, { status: 503 })

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: watchlist, error: watchlistError } = await supabase.from('retailer_price_watchlist').select('id, workspace_id, provider, query, zipcode, store_id').eq('active', true)
  if (watchlistError) return NextResponse.json({ error: 'Could not load pricing watchlist.', detail: watchlistError.message }, { status: 502 })
  const workspaceIds = [...new Set((watchlist ?? []).map(item => item.workspace_id))]
  const { data: settings } = workspaceIds.length ? await supabase.from('workspace_settings').select('workspace_id,price_refresh_frequency').in('workspace_id', workspaceIds) : { data: [] }
  const frequencyByWorkspace = new Map((settings ?? []).map(item => [item.workspace_id, item.price_refresh_frequency]))

  const month = `${new Date().toISOString().slice(0, 7)}-01`
  const results: Array<Record<string, unknown>> = []
  let lowesToken: string | null = null
  for (const item of (watchlist ?? []) as WatchlistItem[]) {
    const frequency = frequencyByWorkspace.get(item.workspace_id) ?? 'weekly'
    if (frequency !== 'weekly') { results.push({ watchlistId: item.id, status: frequency === 'manual' ? 'manual_only' : 'disabled' }); continue }
    if (item.provider === 'home_depot' && !rapidApiKey) { results.push({ watchlistId: item.id, provider: item.provider, status: 'provider_not_configured' }); continue }
    if (item.provider === 'lowes' && !lowesToken) {
      const oauth = await getLowesAccessToken()
      if (!oauth.token) { results.push({ watchlistId: item.id, provider: item.provider, status: 'provider_not_configured', detail: oauth.error }); continue }
      lowesToken = oauth.token
    }

    const { data: cached } = await supabase.from('retailer_price_snapshots').select('id').eq('workspace_id', item.workspace_id).eq('provider', item.provider).eq('query', item.query).eq('zipcode', item.zipcode).eq('store_id', item.store_id).gt('expires_at', new Date().toISOString()).limit(1).maybeSingle()
    if (cached) { results.push({ watchlistId: item.id, provider: item.provider, status: 'cached' }); continue }

    const { data: reserved, error: reserveError } = await supabase.rpc('reserve_retailer_price_query_worker', { p_workspace_id: item.workspace_id, p_provider: item.provider, p_query_month: month, p_monthly_limit: MONTHLY_LIMIT })
    if (reserveError || !reserved) { results.push({ watchlistId: item.id, provider: item.provider, status: 'budget_exhausted' }); continue }

    let apiUrl: URL
    let headers: Record<string, string>
    if (item.provider === 'lowes') {
      apiUrl = new URL(LOWES_PRODUCT_SEARCH_URL)
      apiUrl.searchParams.set('site', 'LOWES'); apiUrl.searchParams.set('searchTerms', item.query); apiUrl.searchParams.set('rollUpVariants', '1'); apiUrl.searchParams.set('maxResults', '24'); apiUrl.searchParams.set('channel', 'Digital_marketplace')
      if (item.zipcode) apiUrl.searchParams.set('zipCode', item.zipcode)
      if (item.store_id) apiUrl.searchParams.set('storeNumber', item.store_id)
      headers = { 'X-Client-Id': process.env.LOWES_CLIENT_ID!, Authorization: `Bearer ${lowesToken!}`, accept: 'application/json' }
    } else {
      apiUrl = new URL(`https://${HOME_DEPOT_HOST}/search`)
      apiUrl.searchParams.set('query', item.query); apiUrl.searchParams.set('page', '1'); apiUrl.searchParams.set('items_per_page', '24'); apiUrl.searchParams.set('sort_by', 'best_match')
      if (item.zipcode) apiUrl.searchParams.set('zipcode', item.zipcode)
      if (item.store_id) apiUrl.searchParams.set('store_id', item.store_id)
      headers = { 'x-rapidapi-host': HOME_DEPOT_HOST, 'x-rapidapi-key': rapidApiKey!, 'content-type': 'application/json' }
    }
    const response = await fetch(apiUrl, { headers, cache: 'no-store' })
    const text = await response.text()
    let payload: unknown
    try { payload = JSON.parse(text) } catch { payload = { message: text.slice(0, 500) } }
    if (!response.ok) { results.push({ watchlistId: item.id, provider: item.provider, status: 'provider_error', code: response.status }); continue }

    const { error: insertError } = await supabase.from('retailer_price_snapshots').insert({ workspace_id: item.workspace_id, provider: item.provider, query: item.query, zipcode: item.zipcode, store_id: item.store_id, source_url: apiUrl.toString(), response: payload, expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), created_by: null })
    results.push({ watchlistId: item.id, provider: item.provider, status: insertError ? 'cache_error' : 'refreshed' })
  }

  return NextResponse.json({ providers: ['home_depot', 'lowes'], cadence: 'weekly', refreshedAt: new Date().toISOString(), count: results.length, results })
}
