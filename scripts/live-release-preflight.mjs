import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { globSync } from 'node:fs'

export const requiredNames = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'CRON_SECRET',
]

/** Return the required env names that are absent or blank in the given env. */
export function validateRequiredNames(env = process.env) {
  return requiredNames.filter((name) => !String(env[name] ?? '').trim())
}

const sourceFiles = globSync('{app,apps,lib,workers,scripts}/**/*.{ts,tsx,mjs,cjs}', { exclude: (path) => path.includes('/node_modules/') })
const publicSecretPattern = /NEXT_PUBLIC_(?:SUPABASE_SERVICE_ROLE_KEY|CRON_SECRET|CAPOUT_API_KEY|RAPIDAPI_KEY|TWILIO_AUTH_TOKEN)/
const violations = []
for (const file of sourceFiles) {
  if (file.endsWith('live-release-preflight.mjs')) continue
  const source = readFileSync(file, 'utf8')
  if (publicSecretPattern.test(source)) violations.push(file)
}
assert.equal(violations.length, 0, `server secrets must not be exposed through NEXT_PUBLIC_* names: ${violations.join(', ')}`)

const missing = validateRequiredNames()
const enforceEnv = process.env.ROOF_PREFLIGHT_ENV_CHECK === '1'
if (enforceEnv) {
  assert.equal(missing.length, 0, `required deployment env vars are missing: ${missing.join(', ')}`)
}

console.log('Static release preflight: PASS (one static source pattern only)')
console.log(`Declared required variable names: ${requiredNames.join(', ')}`)
console.log(
  enforceEnv
    ? 'Required env presence: ENFORCED (ROOF_PREFLIGHT_ENV_CHECK=1; missing: none)'
    : `Required env presence: UNVERIFIED in CI (set ROOF_PREFLIGHT_ENV_CHECK=1 at deploy time; no secret values are read here)`
)
console.log('External gates still unknown: live schema parity, authenticated RLS, physical device, worker runtime, backup restore, and provider execution.')
console.log('No network request, provider call, secret value read, or database write was performed.')
