export function beaconConfigured() {
  return Boolean(process.env.BEACON_API_BASE?.trim() && process.env.BEACON_ACCESS_TOKEN?.trim() && process.env.BEACON_ACCOUNT_ID?.trim())
}

export async function priceBeaconItem(item: { sku: string; quantity: number; uom?: string }) {
  const base = process.env.BEACON_API_BASE?.trim()?.replace(/\/$/, '')
  const token = process.env.BEACON_ACCESS_TOKEN?.trim()
  const accountId = process.env.BEACON_ACCOUNT_ID?.trim()
  if (!base || !token || !accountId) {
    return { ok: false as const, status: 503, error: 'Beacon add-on is off. QXO must supply the API base, account token, and account id.' }
  }
  const response = await fetch(`${base}/quotePricing`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({
      accountId,
      lines: [{ sku: item.sku, quantity: item.quantity, uom: item.uom || 'EA' }],
    }),
    cache: 'no-store',
  })
  const text = await response.text()
  let payload: unknown
  try {
    payload = JSON.parse(text)
  } catch {
    payload = { message: text.slice(0, 500) }
  }
  if (!response.ok) return { ok: false as const, status: 502, error: 'Beacon price call failed.', provider: payload }
  return { ok: true as const, provider: payload, sourceUrl: `${base}/quotePricing` }
}
