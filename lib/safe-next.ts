const CONTROL_OR_BACKSLASH = /[\u0000-\u001f\u007f\\]/

/**
 * Accept only same-origin absolute paths. The origin argument is supplied by
 * the current request/browser so protocol-relative and encoded host tricks
 * cannot become external redirects.
 */
export function safeNext(value: string | null | undefined, origin: string): string {
  if (!value || CONTROL_OR_BACKSLASH.test(value) || !value.startsWith('/')) return '/'
  try {
    const resolved = new URL(value, origin)
    if (resolved.origin !== new URL(origin).origin || resolved.protocol !== new URL(origin).protocol) return '/'
    return `${resolved.pathname}${resolved.search}${resolved.hash}`
  } catch {
    return '/'
  }
}
