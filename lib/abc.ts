export const ABC_PRICE_URL = 'https://partners.abcsupply.com/api/pricing/v2/prices'

export type AbcPriceLine = {
  itemNumber: string
  quantity: number
  uom?: string
}

export function abcConfigured() {
  return Boolean(process.env.ABC_ACCESS_TOKEN?.trim() && process.env.ABC_BRANCH_NUMBER?.trim() && process.env.ABC_SHIP_TO?.trim())
}

export async function priceAbcItems(lines: AbcPriceLine[]) {
  const token = process.env.ABC_ACCESS_TOKEN?.trim()
  const branchNumber = process.env.ABC_BRANCH_NUMBER?.trim()
  const shipTo = process.env.ABC_SHIP_TO?.trim()
  if (!token || !branchNumber || !shipTo) {
    return { ok: false as const, status: 503, error: 'ABC Supply add-on is off. Account token, branch, and ship-to are required.' }
  }
  const response = await fetch(ABC_PRICE_URL, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({
      branchNumber,
      shipToAccountNumber: shipTo,
      requestPurpose: 'estimate',
      lines: lines.map((line) => ({
        itemNumber: line.itemNumber,
        quantity: line.quantity,
        uom: line.uom || 'EA',
      })),
    }),
    cache: 'no-store',
  })
  const text = await response.text()
  let payload: unknown = text.slice(0, 2000)
  try {
    payload = JSON.parse(text)
  } catch {
    payload = { message: text.slice(0, 500) }
  }
  if (!response.ok) {
    return { ok: false as const, status: 502, error: 'ABC Supply price call failed.', provider: payload }
  }
  return { ok: true as const, provider: payload }
}
