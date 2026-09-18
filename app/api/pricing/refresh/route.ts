import { NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'
import { fetchWithTimeout, parseProviderBody, requireWorkspaceMember } from '../../../../lib/api-security'

const HOST = 'real-time-home-depot-data.p.rapidapi.com'
const LIMIT = 100

export async function POST() {
  const rapidApiKey = process.env.RAPIDAPI_KEY
  if (!rapidApiKey) return NextResponse.json({ error: 'Home Depot pricing integration is not configured.' }, { status: 503 })
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  const { data: workspaceId } = await supabase.rpc('current_workspace_id')
  if (!workspaceId) return NextResponse.json({ error: 'No workspace is configured.' }, { status: 400 })
  const membership = await requireWorkspaceMember(supabase, user.id, workspaceId)
  if (membership.response) return membership.response
  const { data: watchlist, error } = await supabase.from('retailer_price_watchlist').select('id,query,zipcode,store_id').eq('workspace_id', workspaceId).eq('active', true)
  if (error) return NextResponse.json({ error: 'Could not load the pricing watchlist.', detail: error.message }, { status: 502 })
  const month = `${new Date().toISOString().slice(0, 7)}-01`
  const results: Array<Record<string, unknown>> = []
  for (const item of watchlist ?? []) {
    const { data: reserved, error: reserveError } = await supabase.rpc('reserve_retailer_price_query', { p_workspace_id: workspaceId, p_provider: 'home_depot', p_query_month: month, p_monthly_limit: LIMIT })
    if (reserveError || !reserved) { results.push({ query: item.query, status: 'budget_exhausted' }); continue }
    const url = new URL(`https://${HOST}/search`)
    url.searchParams.set('query', item.query); url.searchParams.set('page', '1'); url.searchParams.set('items_per_page', '24'); url.searchParams.set('sort_by', 'best_match')
    if (item.zipcode) url.searchParams.set('zipcode', item.zipcode)
    if (item.store_id) url.searchParams.set('store_id', item.store_id)
    const response = await fetchWithTimeout(url, { headers: { 'x-rapidapi-host': HOST, 'x-rapidapi-key': rapidApiKey }, cache: 'no-store' })
    const text = await response.text()
    const payload = parseProviderBody(text)
    if (!response.ok) { results.push({ query: item.query, status: 'provider_error', code: response.status }); continue }
    const { error: insertError } = await supabase.from('retailer_price_snapshots').insert({ workspace_id: workspaceId, provider: 'home_depot', query: item.query, zipcode: item.zipcode, store_id: item.store_id, source_url: url.toString(), response: payload, expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), created_by: user.id })
    results.push({ query: item.query, status: insertError ? 'cache_error' : 'refreshed' })
  }
  return NextResponse.json({ provider: 'home_depot', cadence: 'manual', refreshedAt: new Date().toISOString(), count: results.length, results })
}
