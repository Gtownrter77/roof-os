// Sandbox policy for adjuster tooling. Default is blocked: a capability is
// granted only by an explicit allowlist, and redirects are re-checked so a
// permitted start URL cannot smuggle a request to an unpermitted host.

export const DEFAULT_SANDBOX_ALLOWLIST: readonly string[] = []

function hostnameOf(input: string): string | null {
  try {
    const url = new URL(input)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    return url.hostname.toLowerCase()
  } catch {
    return null
  }
}

export function isAllowlisted(input: string, allowlist: readonly string[] = DEFAULT_SANDBOX_ALLOWLIST): boolean {
  const hostname = hostnameOf(input)
  if (!hostname) return false
  return allowlist.some((entry) => hostname === entry.toLowerCase())
}

/** Re-check the final URL after any redirect before the action is authorized. */
export function authorizeSandboxUrl(
  input: string,
  allowlist: readonly string[] = DEFAULT_SANDBOX_ALLOWLIST,
  resolveFinalUrl?: (url: string) => string,
): { allowed: boolean; finalUrl: string; reason?: string } {
  if (!isAllowlisted(input, allowlist)) {
    return { allowed: false, finalUrl: input, reason: 'blocked_by_default' }
  }
  const finalUrl = resolveFinalUrl ? resolveFinalUrl(input) : input
  if (!isAllowlisted(finalUrl, allowlist)) {
    return { allowed: false, finalUrl, reason: 'redirect_outside_allowlist' }
  }
  return { allowed: true, finalUrl }
}

/**
 * Execute a sandboxed action or fail honestly. An unhandled/blocked action
 * always writes an adjuster_error note; it never returns a fabricated success.
 */
export function runSandboxAction(
  action: { kind: string; url?: string },
  deps: {
    allowlist?: readonly string[]
    perform?: (action: { kind: string; url?: string }) => unknown
    resolveFinalUrl?: (url: string) => string
  } = {},
): { ok: true; result: unknown } | { ok: false; errorNote: { code: string; detail: string } } {
  const allowlist = deps.allowlist ?? DEFAULT_SANDBOX_ALLOWLIST
  if (!deps.perform) {
    return { ok: false, errorNote: { code: 'adjuster_error', detail: 'Sandbox action blocked: no executable capability' } }
  }
  if (action.url) {
    const decision = authorizeSandboxUrl(action.url, allowlist, deps.resolveFinalUrl)
    if (!decision.allowed) {
      return { ok: false, errorNote: { code: 'adjuster_error', detail: `Sandbox action blocked: ${decision.reason}` } }
    }
  }
  try {
    return { ok: true, result: deps.perform(action) }
  } catch (cause) {
    return {
      ok: false,
      errorNote: { code: 'adjuster_error', detail: cause instanceof Error ? cause.message : 'Sandbox action failed.' },
    }
  }
}
