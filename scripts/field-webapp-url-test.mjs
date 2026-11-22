import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolveFieldWebAppUrl } from '../apps/field/src/config/webAppUrl.ts'

// A field build must never silently fall back to the production URL. Missing
// configuration fails closed so staging tokens cannot reach production.
assert.throws(() => resolveFieldWebAppUrl({}), /EXPO_PUBLIC_WEB_APP_URL/, 'missing config must throw')
assert.throws(() => resolveFieldWebAppUrl({ EXPO_PUBLIC_WEB_APP_URL: '   ' }), /EXPO_PUBLIC_WEB_APP_URL/, 'blank config must throw')
assert.equal(
  resolveFieldWebAppUrl({ EXPO_PUBLIC_WEB_APP_URL: 'https://staging.example.com' }),
  'https://staging.example.com',
)
assert.equal(
  resolveFieldWebAppUrl({ NEXT_PUBLIC_WEB_APP_URL: 'https://staging.example.com' }),
  'https://staging.example.com',
  'the legacy NEXT_PUBLIC_ name is still accepted when explicit',
)
assert.throws(() => resolveFieldWebAppUrl({ EXPO_PUBLIC_WEB_APP_URL: 'http://insecure.example.com' }), /https/, 'plain http must be rejected')
assert.equal(
  resolveFieldWebAppUrl({ EXPO_PUBLIC_WEB_APP_URL: 'http://localhost:3000' }, 'dev'),
  'http://localhost:3000',
  'local dev may use http',
)
assert.throws(
  () => resolveFieldWebAppUrl({ EXPO_PUBLIC_WEB_APP_URL: 'http://localhost:3000' }, 'release'),
  /https/,
  'release builds require https',
)
assert.throws(() => resolveFieldWebAppUrl({ EXPO_PUBLIC_WEB_APP_URL: 'not a url' }), /valid URL/)

const app = readFileSync(new URL('../apps/field/App.tsx', import.meta.url), 'utf8')
assert.match(app, /resolveFieldWebAppUrl\(/, 'App.tsx must resolve the URL through the strict helper')
assert.ok(!/roof-os\.onrender\.com/.test(app), 'the hardcoded production fallback must be removed')

// REVIEWER MEDIUM 47: Expo inlines only static process.env.EXPO_PUBLIC_* member
// expressions. Passing the whole process.env object throws at bundle time.
assert.ok(
  /resolveFieldWebAppUrl\(\{\s*EXPO_PUBLIC_WEB_APP_URL:\s*process\.env\.EXPO_PUBLIC_WEB_APP_URL/.test(app),
  'App.tsx must pass an explicit object built from static process.env.EXPO_PUBLIC_* references so Metro can inline it'
)
assert.ok(
  !/resolveFieldWebAppUrl\(process\.env/.test(app),
  'passing the whole process.env object is never inlined by Expo'
)
assert.ok(
  /profile:\s*'release'|resolveFieldWebAppUrl\([^)]*'release'/.test(app),
  'the shipped app must pass the release profile so the https-only rule is active'
)

console.log('field-webapp-url-test: PASS (explicit config required, https enforced, no hardcoded production fallback)')
