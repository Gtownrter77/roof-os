const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/

/**
 * Accept only same-origin path targets. This is intentionally strict because
 * the value can arrive through a user-controlled magic-link query parameter.
 */
export function safeNextPath(value: string | null | undefined, origin: string): string {
  if (!value) return '/'
  let decoded: string
  try { decoded = decodeURIComponent(value) } catch { return '/' }
  if (CONTROL_CHARACTERS.test(decoded) || decoded.includes('\\')) return '/'
  if (!decoded.startsWith('/') || decoded.startsWith('//')) return '/'

  try {
    const resolved = new URL(decoded, origin)
    if (resolved.origin !== origin || resolved.pathname.startsWith('//')) return '/'
    return `${resolved.pathname}${resolved.search}${resolved.hash}`
  } catch {
    return '/'
  }
}
