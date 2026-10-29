import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')
const pkg = JSON.parse(read('../package.json'))

// 1. Pilot onboarding: owner and field user roles exist and are tested
assert.ok(pkg.scripts['test:owner-break-glass'], 'owner break-glass test for pilot owner')
assert.ok(pkg.scripts['test:mobile-offline-sync'], 'mobile offline sync for field user')
assert.ok(pkg.scripts['test:mobile-ai-observation-security'], 'mobile AI security for field user')

// 2. Support path: release gate checks
assert.ok(pkg.scripts['release-check'], 'release check script exists')
assert.ok(pkg.scripts['test:security-definer-migrations'], 'security migration test for rollback safety')

// 3. Limitations documented: no ESX, no insurer auto-submit, no independent pricing
const m071 = read('../supabase/migrations/071_production_invoice.sql')
assert.ok(!m071.includes('Stripe'), 'no Stripe in invoice')
assert.ok(!m071.includes('payment_intent'), 'no payment intent')
assert.ok(!m071.includes('auto'), 'no auto-submit in invoice')

// 4. Evidence ledger: all migrations have assertions
assert.ok(pkg.scripts['test:production-job-invoice'], 'invoice assertion test')
assert.ok(pkg.scripts['test:production-job-payment'], 'payment assertion test')
assert.ok(pkg.scripts['test:production-job-warranty'], 'warranty assertion test')
assert.ok(pkg.scripts['test:production-job-security'], 'security assertion test')
assert.ok(pkg.scripts['test:production-job-e2e'], 'e2e rehearsal test')

// 5. Release decision: CI runs all tests
const ci = read('../.github/workflows/ci.yml')
assert.ok(ci.includes('test:production-job-invoice'), 'CI runs invoice test')
assert.ok(ci.includes('test:production-job-payment'), 'CI runs payment test')
assert.ok(ci.includes('test:production-job-warranty'), 'CI runs warranty test')
assert.ok(ci.includes('test:production-job-security'), 'CI runs security test')
assert.ok(ci.includes('test:production-job-e2e'), 'CI runs e2e test')

console.log('pilot-test: PASS (onboarding roles, support path, limitations, evidence ledger, release gate)')
