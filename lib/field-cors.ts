const MANUS_PREVIEW_ORIGIN = /^https:\/\/[a-z0-9-]+\.us\d+\.manus\.computer$/i
const LOCAL_FIELD_ORIGINS = new Set([
  'http://localhost:8081',
  'http://127.0.0.1:8081',
])

export function allowedFieldCorsOrigin(origin: string | null, env: Record<string, string | undefined> = process.env) {
  if (!origin) return null
  if (LOCAL_FIELD_ORIGINS.has(origin) || MANUS_PREVIEW_ORIGIN.test(origin)) return origin

  const configured = (env.ROOF_OS_FIELD_CORS_ORIGINS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
  return configured.includes(origin) ? origin : null
}

export function applyFieldCorsHeaders(headers: Headers, origin: string | null, env?: Record<string, string | undefined>) {
  const allowedOrigin = allowedFieldCorsOrigin(origin, env)
  if (!allowedOrigin) return headers
  headers.set('Access-Control-Allow-Origin', allowedOrigin)
  headers.set('Access-Control-Allow-Credentials', 'true')
  headers.set('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS')
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Idempotency-Key, Authorization')
  headers.set('Access-Control-Max-Age', '600')
  headers.append('Vary', 'Origin')
  return headers
}
