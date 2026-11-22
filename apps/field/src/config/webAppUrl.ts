/** Resolve the web app base URL used when the field app attaches a bearer token
 * to provenance/report requests. Never fall back to a hardcoded production URL:
 * a staging build missing config must fail closed rather than leak credentials
 * across environments. */

export type FieldEnv = Record<string, string | undefined>
export type FieldProfile = 'dev' | 'release'

export function resolveFieldWebAppUrl(env: FieldEnv, profile: FieldProfile = 'dev'): string {
  const configured = (env.EXPO_PUBLIC_WEB_APP_URL || env.NEXT_PUBLIC_WEB_APP_URL || '').trim()
  if (!configured) {
    throw new Error('EXPO_PUBLIC_WEB_APP_URL must be set for field-to-web requests')
  }
  let parsed: URL
  try {
    parsed = new URL(configured)
  } catch {
    throw new Error('EXPO_PUBLIC_WEB_APP_URL must be a valid URL')
  }
  const isLocal = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1'
  if (parsed.protocol !== 'https:' && !(profile === 'dev' && isLocal && parsed.protocol === 'http:')) {
    throw new Error('EXPO_PUBLIC_WEB_APP_URL must use https (http is allowed only for localhost in dev)')
  }
  return parsed.toString().replace(/\/$/, '')
}
