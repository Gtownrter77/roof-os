const STAGING = 'https://services-qa.roofhub.pro'

export function srsConfigured() {
  return Boolean(process.env.SRS_ACCESS_TOKEN?.trim() && process.env.SRS_CUSTOMER_CODE?.trim() && process.env.SRS_BRANCH_CODE?.trim())
}

export async function priceSrsItem(item: { productId: number; quantity: number; uom?: string }) {
  const token = process.env.SRS_ACCESS_TOKEN?.trim()
  const customerCode = process.env.SRS_CUSTOMER_CODE?.trim()
  const branchCode = process.env.SRS_BRANCH_CODE?.trim()
  if (!token || !customerCode || !branchCode) {
    return { ok: false as const, status: 503, error: 'SRS add-on is off. Account token, customer code, and branch code are required.' }
  }
  const base = (process.env.SRS_API_BASE?.trim() || STAGING).replace(/\/$/, '')
  const response = await fetch(`${base}/products/v2/price`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({
      customerCode,
      branchCode,
      productList: [{ productId: item.productId, quantity: item.quantity, uom: item.uom || 'EA' }],
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
  if (!response.ok) return { ok: false as const, status: 502, error: 'SRS price call failed.', provider: payload }
  return { ok: true as const, provider: payload, sourceUrl: `${base}/products/v2/price` }
}
