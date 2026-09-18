import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'
import { getLowesAccessToken, LOWES_PRODUCT_SEARCH_URL } from '../../../../lib/lowes'
import { fetchWithTimeout, parseProviderBody, requireWorkspaceMember } from '../../../../lib/api-security'

const MONTHLY_LIMIT = 100

export async function GET(request: NextRequest) {
  const clientId = process.env.LOWES_CLIENT_ID
  if (!clientId) return NextResponse.json({ error: 'Lowe\'s OAuth credentials are not configured.' }, { status: 503 })
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  const { data: workspaceId } = await supabase.rpc('current_workspace_id')
  if (!workspaceId) return NextResponse.json({ error: 'No workspace is configured.' }, { status: 400 })
  const membership = await requireWorkspaceMember(supabase, user.id, workspaceId)
  if (membership.response) return membership.response

  const params = request.nextUrl.searchParams
  const query = params.get('query')?.trim()
  const zipcode = params.get('zipcode')?.trim() || undefined
  const storeId = params.get('storeId')?.trim() || undefined
  if (!query || query.length > 120) return NextResponse.json({ error: 'query is required and must be 120 characters or fewer.' }, { status: 400 })
  if (zipcode && !/^\d{5}$/.test(zipcode)) return NextResponse.json({ error: 'zipcode must be five digits.' }, { status: 400 })
  if (storeId && !/^\d{1,12}$/.test(storeId)) return NextResponse.json({ error: 'storeId must contain digits only.' }, { status: 400 })

  const { data: cached } = await supabase.from('retailer_price_snapshots')
    .select('response, retrieved_at, expires_at, source_url')
    .eq('workspace_id', workspaceId).eq('provider', 'lowes').eq('query', query)
    .eq('zipcode', zipcode ?? null).eq('store_id', storeId ?? null)
    .gt('expires_at', new Date().toISOString()).order('retrieved_at', { ascending: false }).limit(1).maybeSingle()
  if (cached) return NextResponse.json({ provider: 'lowes', cached: true, source: 'retailer_reference_only', ...cached })

  const month = `${new Date().toISOString().slice(0, 7)}-01`
  const { data: reserved, error: reserveError } = await supabase.rpc('reserve_retailer_price_query', { p_workspace_id: workspaceId, p_provider: 'lowes', p_query_month: month, p_monthly_limit: MONTHLY_LIMIT })
  if (reserveError) return NextResponse.json({ error: 'Could not reserve the monthly pricing request.', detail: reserveError.message }, { status: 502 })
  if (!reserved) return NextResponse.json({ error: 'Monthly Lowe\'s inquiry limit reached.', limit: MONTHLY_LIMIT }, { status: 429 })

  const oauth = await getLowesAccessToken()
  if (!oauth.token) return NextResponse.json({ error: oauth.error, provider: oauth.provider ?? null }, { status: oauth.status === 401 ? 502 : 503 })

  const apiUrl = new URL(LOWES_PRODUCT_SEARCH_URL)
  apiUrl.searchParams.set('site', 'LOWES')
  apiUrl.searchParams.set('searchTerms', query)
  apiUrl.searchParams.set('rollUpVariants', '1')
  apiUrl.searchParams.set('maxResults', '24')
  apiUrl.searchParams.set('channel', 'Digital_marketplace')
  if (zipcode) apiUrl.searchParams.set('zipCode', zipcode)
  if (storeId) apiUrl.searchParams.set('storeNumber', storeId)

  const response = await fetchWithTimeout(apiUrl, { headers: { 'X-Client-Id': clientId, Authorization: `Bearer ${oauth.token}`, accept: 'application/json' }, cache: 'no-store' })
  const text = await response.text()
  const result = parseProviderBody(text)
  if (!response.ok) return NextResponse.json({ error: 'Lowe\'s pricing provider failed.', provider: result }, { status: 502 })

  const { error: cacheError } = await supabase.from('retailer_price_snapshots').insert({ workspace_id: workspaceId, provider: 'lowes', query, zipcode: zipcode ?? null, store_id: storeId ?? null, source_url: apiUrl.toString(), response: result, expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), created_by: user.id })
  if (cacheError) return NextResponse.json({ error: 'Price was retrieved but could not be cached in the workspace ledger.', detail: cacheError.message }, { status: 502 })
  return NextResponse.json({ provider: 'lowes', cached: false, source: 'retailer_reference_only', retrieved_at: new Date().toISOString(), response: result })
}
