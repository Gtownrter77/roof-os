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
assert.ok(callback.includes("safeNextPath(url.searchParams.get('next'), url.origin)"))
assert.ok(callback.includes('exchangeCodeForSession(code)'))
assert.ok(callback.includes('verifyOtp({ token_hash: tokenHash, type: type as EmailOtpType })'))
for (const type of ['signup', 'invite', 'magiclink', 'recovery', 'email_change', 'email']) {
  assert.ok(callback.includes(`'${type}'`), `callback supports ${type}`)
}
assert.ok(callback.includes('Boolean(code) === Boolean(tokenHash)'), 'callback rejects ambiguous or missing auth result types')
assert.ok(callback.includes("login.searchParams.set('next', next)"), 'safe next is retained after callback errors')
assert.ok(login.includes("type: 'email'"), 'six-digit codes use Supabase email OTP verification')
assert.ok(login.includes('pattern="\\d{6}"'), 'code entry requires exactly six digits')
assert.ok(login.includes('safeNextPath(search.get(\'next\')'), 'client redirects stay on safe next paths')
assert.ok(login.includes('authCooldownSeconds(signInError)') && login.includes('authCooldownSeconds(verifyError)'), 'send and verify rate limits are handled')

console.log('auth-flow-test: PASS (OTP, callback result types, cooldowns, and safe redirects)')
