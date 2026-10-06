import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = new URL('..', import.meta.url).pathname
const appSource = readFileSync(join(root, 'apps', 'field', 'App.tsx'), 'utf8')

// 1. Forgot password button & flow verification
assert.ok(appSource.includes('Forgot password?'), 'Mobile app must include a visible "Forgot password?" button')
assert.ok(appSource.includes('resetPasswordForEmail'), 'Mobile app must trigger resetPasswordForEmail')
assert.ok(appSource.includes('auth/reset'), 'Mobile app must link to web password reset endpoint')
assert.ok(appSource.includes('sendPasswordReset'), 'Mobile app must define sendPasswordReset handler')

// 2. 6-digit email OTP passwordless flow verification
assert.ok(appSource.includes('signInWithOtp'), 'Mobile app must support signInWithOtp for passwordless login')
assert.ok(appSource.includes('verifyOtp'), 'Mobile app must verify email OTP codes')
assert.ok(appSource.includes("type: 'email'"), 'Mobile app OTP verification must use type email')
assert.ok(appSource.includes('6-digit code'), 'Mobile app must have 6-digit code mode')

// 3. Password visibility toggle & ease of use
assert.ok(appSource.includes('showPassword'), 'Mobile app must allow toggling password visibility')
assert.ok(appSource.includes('Show') && appSource.includes('Hide'), 'Mobile app must render Show/Hide toggle button')
assert.ok(appSource.includes('autoCorrect={false}'), 'Mobile app must disable autocorrect on credentials')
assert.ok(appSource.includes('roof_os_field_email'), 'Mobile app must remember last email via SecureStore')

// 4. Production Supabase fallback credentials
assert.ok(appSource.includes('xksumagfbegdlapwysps.supabase.co'), 'Mobile app must have fallback production Supabase URL')
assert.ok(appSource.includes('sb_publishable_'), 'Mobile app must have fallback publishable anon key')

// 5. Browser login fallback
assert.ok(appSource.includes('auth/login'), 'Mobile app must provide direct fallback to web login in browser')

console.log('mobile-auth-test: PASS (forgot password button, 6-digit code OTP, password toggle, SecureStore email memory, and credentials fallback verified)')
