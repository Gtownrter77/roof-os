import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { globSync } from 'node:fs'

const requiredNames = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'CRON_SECRET',
]
const sourceFiles = globSync('{app,apps,lib,workers,scripts}/**/*.{ts,tsx,mjs,cjs}', { exclude: (path) => path.includes('/node_modules/') })
const publicSecretPattern = /NEXT_PUBLIC_(?:SUPABASE_SERVICE_ROLE_KEY|CRON_SECRET|CAPOUT_API_KEY|RAPIDAPI_KEY|TWILIO_AUTH_TOKEN)/
const violations = []
for (const file of sourceFiles) {
  if (file.endsWith('live-release-preflight.mjs')) continue
  const source = readFileSync(file, 'utf8')
  if (publicSecretPattern.test(source)) violations.push(file)
}
assert.equal(violations.length, 0, `server secrets must not be exposed through NEXT_PUBLIC_* names: ${violations.join(', ')}`)

console.log('Static release preflight: PASS')
console.log(`Checked required variable names: ${requiredNames.join(', ')}`)
console.log('External gates still unknown: live schema parity, authenticated RLS, physical device, worker runtime, backup restore, and provider execution.')
console.log('No network request, provider call, secret value read, or database write was performed.')
