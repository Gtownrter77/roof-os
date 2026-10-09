import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'
import { beaconConfigured, priceBeaconItem } from '../../../../lib/beacon'
import { isUuid, readJson, requireWorkspaceMember } from '../../../../lib/api-security'

const MONTHLY_LIMIT = 100

export async function POST(request: NextRequest) {
  if (!beaconConfigured()) return NextResponse.json({ error: 'Beacon add-on is off.', addon: true }, { status: 503 })
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  const { data: workspaceId } = await supabase.rpc('current_workspace_id')
  if (!isUuid(workspaceId)) return NextResponse.json({ error: 'No workspace is configured.' }, { status: 400 })
  const membership = await requireWorkspaceMember(supabase, user.id, workspaceId)
  if (membership.response) return membership.response

  const parsed = await readJson(request, 8 * 1024)
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: parsed.status })
  const body = parsed.body as { sku?: string; quantity?: number; uom?: string }
  const sku = body?.sku?.trim()
  const quantity = body?.quantity
  if (!sku || sku.length > 40 || !Number.isInteger(quantity) || !quantity || quantity < 1 || quantity > 10000) {
    return NextResponse.json({ error: 'sku and a quantity from 1 to 10000 are required.' }, { status: 400 })
  }

  const month = `${new Date().toISOString().slice(0, 7)}-01`
  const { data: reserved, error: reserveError } = await supabase.rpc('reserve_retailer_price_query', {
    p_workspace_id: workspaceId,
    p_provider: 'beacon',
    p_query_month: month,
    p_monthly_limit: MONTHLY_LIMIT,
  })
  if (reserveError) return NextResponse.json({ error: 'Could not reserve the monthly pricing request.', detail: reserveError.message }, { status: 502 })
  if (!reserved) return NextResponse.json({ error: 'Monthly Beacon inquiry limit reached.', limit: MONTHLY_LIMIT }, { status: 429 })

  const priced = await priceBeaconItem({ sku, quantity, uom: body?.uom })
  if (!priced.ok) return NextResponse.json({ error: priced.error, provider: priced.provider ?? null, addon: true }, { status: priced.status })

  const { error: cacheError } = await supabase.from('retailer_price_snapshots').insert({
    workspace_id: workspaceId,
    provider: 'beacon',
    query: sku,
    zipcode: null,
    store_id: process.env.BEACON_ACCOUNT_ID,
    source_url: priced.sourceUrl,
    response: priced.provider,
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    created_by: user.id,
  })
  if (cacheError) return NextResponse.json({ error: 'Beacon price was retrieved but could not be cached.', detail: cacheError.message }, { status: 502 })
  return NextResponse.json({ provider: 'beacon', addon: true, source: 'account_reference_only', response: priced.provider })
}
