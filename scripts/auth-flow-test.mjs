import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

function importTypeScript(relativePath) {
  const source = readFileSync(new URL(relativePath, import.meta.url), 'utf8')
  const code = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText
  return import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
}

const [{ authCooldownSeconds }, { safeNextPath }] = await Promise.all([
  importTypeScript('../lib/auth/cooldown.ts'),
  importTypeScript('../lib/safe-next.ts'),
])

assert.equal(authCooldownSeconds({ status: 400, message: 'Invalid OTP' }), 0)
assert.equal(authCooldownSeconds({ status: 429, message: 'Too many requests' }), 60)
assert.equal(authCooldownSeconds({ code: 'over_email_send_rate_limit', message: 'Try again later' }), 60)
assert.equal(authCooldownSeconds({ status: 429, retryAfter: 45, message: 'rate limit' }), 45)
assert.equal(authCooldownSeconds({ status: 429, message: 'Please wait 25 seconds before retrying' }), 25)
assert.equal(authCooldownSeconds({ status: 429, retryAfter: 900, message: 'rate limit' }), 300)

const origin = 'https://roof-os.example'
assert.equal(safeNextPath('/jobs?id=7#roof', origin), '/jobs?id=7#roof')
assert.equal(safeNextPath('//evil.example/path', origin), '/')
assert.equal(safeNextPath('https://evil.example/', origin), '/')
assert.equal(safeNextPath('/%5C%5Cevil.example/path', origin), '/')

const callback = readFileSync(new URL('../app/auth/callback/route.ts', import.meta.url), 'utf8')
const login = readFileSync(new URL('../app/auth/login/page.tsx', import.meta.url), 'utf8')
const enter = readFileSync(new URL('../app/auth/enter/route.ts', import.meta.url), 'utf8')
const ownerEnter = readFileSync(new URL('../lib/auth/owner-enter.ts', import.meta.url), 'utf8')
const proxy = readFileSync(new URL('../proxy.ts', import.meta.url), 'utf8')
const serverAuth = readFileSync(new URL('../lib/supabase/server.ts', import.meta.url), 'utf8')

assert.ok(callback.includes("safeNextPath(url.searchParams.get('next'), url.origin)"))
assert.ok(callback.includes('exchangeCodeForSession(code)'))
assert.ok(callback.includes('verifyOtp({ token_hash: tokenHash, type: type as EmailOtpType })'))
for (const type of ['signup', 'invite', 'magiclink', 'recovery', 'email_change', 'email']) {
  assert.ok(callback.includes(`'${type}'`), `callback supports ${type}`)
}
assert.ok(callback.includes('Boolean(code) === Boolean(tokenHash)'), 'callback rejects ambiguous or missing auth result types')
assert.ok(callback.includes("enter.searchParams.set('next', next)"), 'safe next is retained after callback errors')

assert.ok(proxy.includes("pathname === '/admin'"), 'developer console route stays public without login')
assert.ok(proxy.includes("pathname === '/api/status'"), 'status health stays reachable without a session')
assert.ok(proxy.includes("/auth/login"), 'unauthenticated HTML navigations go to break-glass login')
assert.ok(!proxy.includes("enter.searchParams.set('next', pathname"), 'proxy must not auto-bounce every visitor into owner enter')
assert.ok(enter.includes('roof_os_skip_enter'), 'enter sets a skip cookie when minting fails')
assert.ok(enter.includes('assertOwnerEnterAuthorized'), 'enter requires break-glass authorization')
assert.ok(enter.includes("searchParams.get('key')"), 'enter accepts key query param')
assert.ok(enter.includes("headers.get('x-roof-os-enter')"), 'enter accepts enter header')

assert.ok(enter.includes('establishOwnerSession'), 'enter route mints an owner session')
assert.ok(enter.includes('safeNextPath'), 'enter route keeps redirects on-site')
assert.ok(ownerEnter.includes('generateLink'), 'owner enter uses admin magic-link minting')
assert.ok(ownerEnter.includes("type: 'magiclink'"), 'owner enter verifies a magiclink token hash')
assert.ok(ownerEnter.includes('SUPABASE_SERVICE_ROLE_KEY'), 'owner enter requires the service role')
assert.ok(ownerEnter.includes('assertOwnerEnterAuthorized'), 'owner enter re-exports break-glass gate')
assert.ok(!ownerEnter.includes('listUsers'), 'owner enter must not fall back to oldest Auth user')

const ownerEnterGate = readFileSync(new URL('../lib/auth/owner-enter-gate.ts', import.meta.url), 'utf8')
assert.ok(ownerEnterGate.includes('OWNER_ENTER_SECRET'), 'break-glass requires OWNER_ENTER_SECRET')
assert.ok(ownerEnterGate.includes('timingSafeEqual'), 'secret compare is timing-safe')

assert.ok(login.includes('/auth/enter'), 'login page can forward into enter with key')
assert.ok(login.includes('safeNextPath'), 'login forward keeps next path safe')
assert.ok(login.includes('Owner enter key'), 'login collects break-glass key')
assert.ok(login.includes("enter.searchParams.set('key', trimmed)"), 'login passes key into enter')

const developerConsole = readFileSync(new URL('../app/admin/page.tsx', import.meta.url), 'utf8')
assert.ok(developerConsole.includes('Developer Console'), 'public admin route is the developer console')
assert.ok(!developerConsole.includes('createClient') && !developerConsole.includes('updateUser'), 'public developer console exposes no account or password actions')
assert.ok(serverAuth.includes('cookieStore.set(name, value, options)'), 'server auth client persists callback session cookies')

const reset = readFileSync(new URL('../app/auth/reset/page.tsx', import.meta.url), 'utf8')
assert.ok(reset.includes('Reset link needed'), 'reset route explains missing or expired links')
assert.ok(reset.includes('supabase.auth.updateUser({ password })'), 'reset route updates the password')
assert.ok(reset.includes("/auth/login"), 'reset route returns into break-glass login after success')

// Runtime gate checks (gate module has no Supabase deps)
const { assertOwnerEnterAuthorized } = await importTypeScript('../lib/auth/owner-enter-gate.ts')
const prev = process.env.OWNER_ENTER_SECRET
delete process.env.OWNER_ENTER_SECRET
assert.equal(assertOwnerEnterAuthorized({ providedKey: 'anything-long-enough' }).ok, false)
process.env.OWNER_ENTER_SECRET = 'sixteen-chars-min'
assert.equal(assertOwnerEnterAuthorized({ providedKey: 'wrong-key-value!!!!' }).ok, false)
assert.equal(assertOwnerEnterAuthorized({ providedKey: 'sixteen-chars-min' }).ok, true)
if (prev === undefined) delete process.env.OWNER_ENTER_SECRET
else process.env.OWNER_ENTER_SECRET = prev

console.log('auth-flow-test: PASS (private break-glass enter, callback types, cooldowns, safe redirects)')
