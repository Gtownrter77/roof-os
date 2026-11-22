import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// 54: the scanner must be state-free across files. The old `g`-flag regex kept
// lastIndex between files, so a secret at a lower offset in a later file was
// silently skipped while the gate still logged "secret scan verified".
const { scanForSecrets } = await import('./secret-scan.mjs')

const files = [
  { path: 'app/api/a/route.ts', source: 'const x = 1\nSUPABASE_SERVICE_ROLE_KEY=SUPERSECRETVALUEATOFFSET50\n' },
  { path: 'app/api/b/route.ts', source: 'CAPOUT_API_KEY=ANOTHERSECRET\n' },
]
const findings = scanForSecrets(files)
assert.deepEqual(
  findings.map((f) => f.path).sort(),
  ['app/api/a/route.ts', 'app/api/b/route.ts'],
  'a secret in each file must be found regardless of match offset'
)
assert.ok(findings.every((f) => f.name), 'each finding must name the matched pattern')

const provider = scanForSecrets([{ path: 'lib/pay.ts', source: 'const key = "sk_live_51AbCdEfGhIjKlMnOp"' }])
assert.equal(provider.length, 1, 'a Stripe live-key prefix must be flagged')
assert.equal(provider[0].name, 'stripe_live_key')

const placeholders = scanForSecrets([{
  path: 'lib/ok.ts',
  source: [
    'SUPABASE_SERVICE_ROLE_KEY=your_service_role_key',
    'CAPOUT_API_KEY=server_only_value',
    'RAPIDAPI_KEY=validation-only-value',
  ].join('\n'),
}])
assert.deepEqual(placeholders, [], 'documented placeholders must not be flagged')

const wrapped = scanForSecrets([
  { path: 'config/runtime.yml', source: 'CAPOUT_API_KEY: abcdefghijklmnop' },
  { path: 'config/cron.env', source: 'CRON_SECRET="quotedsecretvalue"' },
  { path: 'config/stripe.env', source: "STRIPE_SECRET_KEY='singlequotedvalue'" },
  { path: 'config/twilio.yml', source: 'twilio_auth_token: lowercasenamevalue' },
])
assert.equal(wrapped.length, 4, 'quoted YAML/env values and lowercase names must be scanned too')

const envReads = scanForSecrets([{
  path: 'lib/env.ts',
  source: 'const key = process.env.CAPOUT_API_KEY ?? ""\nif (env.STRIPE_SECRET_KEY) return true',
}])
assert.deepEqual(envReads, [], 'reading an env var is not a hard-coded secret')

const scanner = readFileSync(new URL('./secret-scan.mjs', import.meta.url), 'utf8')
assert.ok(!/lastIndex/.test(scanner), 'scanner must not rely on mutable regex state')

console.log('secret-scan-test: PASS (state-free, provider prefixes, placeholders honored)')
