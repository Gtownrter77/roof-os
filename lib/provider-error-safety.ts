/** Fixed, bounded client messages for upstream provider failures. Raw provider
 * bodies may echo credentials, hostnames, or signed URLs and stay server-side. */

export function clientSafeProviderError(kind: 'lowes-token' | 'lowes-search', status: number): string {
  const prefix = kind === 'lowes-token' ? "Lowe's OAuth" : "Lowe's pricing"
  if (status === 401 || status === 403) return `${prefix} credentials were rejected.`
  if (status >= 500) return `${prefix} provider is unavailable.`
  return `${prefix} request failed.`
}
