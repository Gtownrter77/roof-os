const LOWES_TOKEN_URL = 'https://apim.lowes.com/auth/token'

export const LOWES_PRODUCT_SEARCH_URL = 'https://apis-b2b.lowes.com/lowesx-marketplace-gateway/api/v1/search/items'

type LowesCredentials = { clientId: string; clientSecret: string }

async function getCredentials(): Promise<LowesCredentials | null> {
  const clientId = process.env.LOWES_CLIENT_ID
  const clientSecret = process.env.LOWES_CLIENT_SECRET
  return clientId && clientSecret ? { clientId, clientSecret } : null
}

export async function getLowesAccessToken() {
  const credentials = await getCredentials()
  if (!credentials) return { token: null, error: 'Lowe\'s OAuth credentials are not configured.' }

  const response = await fetch(LOWES_TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: credentials.clientId, client_secret: credentials.clientSecret }).toString(),
    cache: 'no-store',
  })
  const text = await response.text()
  let payload: unknown
  try { payload = JSON.parse(text) } catch { payload = { message: text.slice(0, 500) } }
  if (!response.ok || !payload || typeof payload !== 'object' || typeof (payload as { access_token?: unknown }).access_token !== 'string') {
    return { token: null, error: 'Lowe\'s OAuth token request failed.', status: response.status, provider: payload }
  }
  return { token: (payload as { access_token: string }).access_token, error: null }
}
