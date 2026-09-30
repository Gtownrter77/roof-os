import type { EmailOtpType } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { createClient } from '../../../lib/supabase/server'
import { safeNextPath } from '../../../lib/safe-next'

const EMAIL_OTP_TYPES = new Set<EmailOtpType>([
  'signup',
  'invite',
  'magiclink',
  'recovery',
  'email_change',
  'email',
])

function redirectNoStore(url: URL, destination: URL) {
  const response = NextResponse.redirect(destination)
  response.headers.set('Cache-Control', 'no-store')
  return response
}

function callbackFailure(url: URL, next: string) {
  const login = new URL('/auth/login', url.origin)
  login.searchParams.set('error', 'auth_callback_failed')
  login.searchParams.set('next', next)
  return redirectNoStore(url, login)
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const next = safeNextPath(url.searchParams.get('next'), url.origin)
  const code = url.searchParams.get('code')
  const tokenHash = url.searchParams.get('token_hash')
  const type = url.searchParams.get('type')
  const providerError = url.searchParams.get('error')

  // Accept exactly one Supabase result form. Never reflect provider errors or tokens.
  if (providerError || Boolean(code) === Boolean(tokenHash)) return callbackFailure(url, next)
  if ((code && code.length > 4096) || (tokenHash && tokenHash.length > 4096)) return callbackFailure(url, next)

  try {
    const supabase = await createClient()
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code)
      if (error) return callbackFailure(url, next)
    } else {
      if (!tokenHash || !type || !EMAIL_OTP_TYPES.has(type as EmailOtpType)) return callbackFailure(url, next)
      const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: type as EmailOtpType })
      if (error) return callbackFailure(url, next)
    }

    return redirectNoStore(url, new URL(next, url.origin))
  } catch {
    return callbackFailure(url, next)
  }
}
