import { NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'
import { fetchWithTimeout, parseProviderBody, requireWorkspaceMember } from '../../../../lib/api-security'
import { getLowesAccessToken, LOWES_PRODUCT_SEARCH_URL } from '../../../../lib/lowes'

const HOST = 'real-time-home-depot-data.p.rapidapi.com'
const LIMIT = 100

export async function POST() {
  const rapidApiKey = process.env.RAPIDAPI_KEY
  const lowesClientId = process.env.LOWES_CLIENT_ID
  if (!rapidApiKey && !lowesClientId) {
    return NextResponse.json({ error: 'Retailer pricing integrations are not configured.' }, { status: 503 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })

  const { data: workspaceId } = await supabase.rpc('current_workspace_id')
  if (!workspaceId) return NextResponse.json({ error: 'No workspace is configured.' }, { status: 400 })

  const membership = await requireWorkspaceMember(supabase, user.id, workspaceId)
  if (membership.response) return membership.response

  const { data: watchlist, error } = await supabase
    .from('retailer_price_watchlist')
    .select('id,provider,query,zipcode,store_id')
    .eq('workspace_id', workspaceId)
    .eq('active', true)

  if (error) return NextResponse.json({ error: 'Could not load the pricing watchlist.', detail: error.message }, { status: 502 })

  const month = `${new Date().toISOString().slice(0, 7)}-01`
  const results: Array<Record<string, unknown>> = []
  let lowesToken: string | null = null

  for (const item of watchlist ?? []) {
    const provider = item.provider === 'lowes' ? 'lowes' : 'home_depot'

    if (provider === 'lowes') {
      if (!lowesClientId) {
        results.push({ query: item.query, provider, status: 'provider_not_configured' })
        continue
      }
      if (!lowesToken) {
        const oauth = await getLowesAccessToken().catch(() => ({ token: null, error: 'Lowe\'s OAuth token failed' }))
        if (!oauth.token) {
          results.push({ query: item.query, provider, status: 'provider_not_configured', detail: oauth.error })
          continue
        }
        lowesToken = oauth.token
      }
    } else if (!rapidApiKey) {
      results.push({ query: item.query, provider, status: 'provider_not_configured' })
      continue
    }

    const { data: reserved, error: reserveError } = await supabase.rpc('reserve_retailer_price_query', {
      p_workspace_id: workspaceId,
      p_provider: provider,
      p_query_month: month,
      p_monthly_limit: LIMIT
    })
    if (reserveError || !reserved) {
      results.push({ query: item.query, provider, status: 'budget_exhausted' })
      continue
    }

    let url: URL
    let headers: Record<string, string>

    if (provider === 'lowes') {
      url = new URL(LOWES_PRODUCT_SEARCH_URL)
      url.searchParams.set('site', 'LOWES')
      url.searchParams.set('searchTerms', item.query)
      url.searchParams.set('rollUpVariants', '1')
      url.searchParams.set('maxResults', '24')
      url.searchParams.set('channel', 'Digital_marketplace')
      if (item.zipcode) url.searchParams.set('zipCode', item.zipcode)
      if (item.store_id) url.searchParams.set('storeNumber', item.store_id)
      headers = { 'X-Client-Id': lowesClientId!, Authorization: `Bearer ${lowesToken!}`, accept: 'application/json' }
    } else {
      url = new URL(`https://${HOST}/search`)
      url.searchParams.set('query', item.query)
      url.searchParams.set('page', '1')
      url.searchParams.set('items_per_page', '24')
      url.searchParams.set('sort_by', 'best_match')
      if (item.zipcode) url.searchParams.set('zipcode', item.zipcode)
      if (item.store_id) url.searchParams.set('store_id', item.store_id)
      headers = { 'x-rapidapi-host': HOST, 'x-rapidapi-key': rapidApiKey!, 'content-type': 'application/json' }
    }

    const response = await fetchWithTimeout(url, { headers, cache: 'no-store' }, 8_000).catch(() => null)
    if (!response) {
      results.push({ query: item.query, provider, status: 'provider_timeout' })
      continue
    }

    const text = await response.text()
    const payload = parseProviderBody(text)
    if (!response.ok) {
      results.push({ query: item.query, provider, status: 'provider_error', code: response.status })
      continue
    }

    const { error: insertError } = await supabase.from('retailer_price_snapshots').insert({
      workspace_id: workspaceId,
      provider,
      query: item.query,
      zipcode: item.zipcode,
      store_id: item.store_id,
      source_url: url.toString(),
      response: payload,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      created_by: user.id
    })

    results.push({ query: item.query, provider, status: insertError ? 'cache_error' : 'cached', price: null, error: insertError?.message ?? null })
  }

  return NextResponse.json({
    providers: ['home_depot', 'lowes'],
    cadence: 'manual',
    refreshedAt: new Date().toISOString(),
    count: results.length,
    results
  })
}
