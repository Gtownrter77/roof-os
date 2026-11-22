// Shared, state-free secret scanner. Patterns deliberately omit the /g flag:
// a global regex keeps its match cursor between .test() calls, which let a real
// secret at a lower offset in a later file slip through the old gate.
export const SECRET_PATTERNS = [
  {
    name: 'assigned_server_secret',
    pattern: /\b(?:SUPABASE_SERVICE_ROLE_KEY|CAPOUT_API_KEY|RAPIDAPI_KEY|OWNER_ENTER_SECRET|LOWES_CLIENT_SECRET|CRON_SECRET|STRIPE_SECRET_KEY|STRIPE_WEBHOOK_SECRET|TWILIO_AUTH_TOKEN)\s*[:=]\s*['"`]?(?!your_|server_only_|validation-only-|process\.env)[A-Za-z0-9_\-./]{8,}/i,
  },
  { name: 'stripe_live_key', pattern: /sk_live_[A-Za-z0-9]{8,}/ },
  { name: 'google_api_key', pattern: /AIza[A-Za-z0-9_-]{20,}/ },
  { name: 'github_pat', pattern: /ghp_[A-Za-z0-9]{20,}/ },
  { name: 'slack_token', pattern: /xoxb-[A-Za-z0-9-]{10,}/ },
]

/**
 * @param {{path: string, source: string}[]} files
 * @returns {{path: string, name: string}[]}
 */
export function scanForSecrets(files) {
  const findings = []
  const seen = new Set()
  for (const { path, source } of files) {
    for (const { name, pattern } of SECRET_PATTERNS) {
      if (pattern.test(source)) {
        const key = `${path}::${name}`
        if (!seen.has(key)) {
          seen.add(key)
          findings.push({ path, name })
        }
      }
    }
  }
  return findings
}
