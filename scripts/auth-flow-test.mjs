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
const proxy = readFileSync(new URL('../proxy.ts', import.meta.url), 'utf8')
const serverAuth = readFileSync(new URL('../lib/supabase/server.ts', import.meta.url), 'utf8')
assert.ok(callback.includes("safeNextPath(url.searchParams.get('next'), url.origin)"))
assert.ok(callback.includes('exchangeCodeForSession(code)'))
assert.ok(callback.includes('verifyOtp({ token_hash: tokenHash, type: type as EmailOtpType })'))
for (const type of ['signup', 'invite', 'magiclink', 'recovery', 'email_change', 'email']) {
  assert.ok(callback.includes(`'${type}'`), `callback supports ${type}`)
}
assert.ok(callback.includes('Boolean(code) === Boolean(tokenHash)'), 'callback rejects ambiguous or missing auth result types')
assert.ok(callback.includes("login.searchParams.set('next', next)"), 'safe next is retained after callback errors')
assert.ok(proxy.includes("pathname.startsWith('/auth')"), 'auth callback stays public until Supabase has established the session cookie')
assert.ok(proxy.includes("pathname === '/admin'"), 'developer console route stays public without login')
const developerConsole = readFileSync(new URL('../app/admin/page.tsx', import.meta.url), 'utf8')
assert.ok(developerConsole.includes('Developer Console'), 'public admin route is the developer console')
assert.ok(!developerConsole.includes('createClient') && !developerConsole.includes('updateUser'), 'public developer console exposes no account or password actions')
assert.ok(proxy.includes('if (!user && !isPublicPath(pathname))'), 'protected-route redirect does not run on public auth routes')
assert.ok(serverAuth.includes('cookieStore.set(name, value, options)'), 'server auth client persists callback session cookies')
assert.ok(login.includes("type: 'email'"), 'six-digit codes use Supabase email OTP verification')
assert.ok(login.includes('pattern="\\d{6}"'), 'code entry requires exactly six digits')
assert.ok(login.includes('safeNextPath(search.get(\'next\')'), 'client redirects stay on safe next paths')
assert.ok(login.includes('authCooldownSeconds(signInError)') && login.includes('authCooldownSeconds(verifyError)'), 'sign-in and verification rate limits are handled')
assert.ok(login.includes("useState<Mode>('password')"), 'password sign-in is the default')
assert.ok(login.includes('supabase.auth.signInWithPassword({'), 'password mode uses Supabase email/password authentication')
assert.ok(login.includes('autoComplete="current-password"'), 'password input uses the browser password manager safely')
assert.ok(login.includes('if (mode === \'password\') void signInWithPassword()'), 'password login is wired to form submission')
assert.ok(login.includes('Forgot password?'), 'password mode has a visible recovery action')
assert.ok(login.includes('supabase.auth.resetPasswordForEmail'), 'recovery sends a Supabase password reset email')
assert.ok(login.includes("redirectTo: `${window.location.origin}/auth/reset`"), 'recovery returns to the password reset route')
assert.ok(login.includes('storedResetCooldown') && login.includes('rememberResetCooldown'), 'reset requests use a persistent per-email cooldown')
assert.ok(login.includes('Try again in ${resetCooldown}s'), 'reset button explains when another request is allowed')
assert.ok(login.includes('router.replace(next)') && login.includes('router.refresh()'), 'password login follows the safe redirect and refreshes server auth state')

const reset = readFileSync(new URL('../app/auth/reset/page.tsx', import.meta.url), 'utf8')
assert.ok(reset.includes('Reset link needed'), 'reset route explains missing or expired links')
assert.ok(reset.includes('supabase.auth.updateUser({ password })'), 'reset route updates the password')
assert.ok(reset.includes("router.replace('/auth/login?reset=success')"), 'reset route returns to sign in after success')

console.log('auth-flow-test: PASS (password, OTP, callback result types, cooldowns, and safe redirects)')
