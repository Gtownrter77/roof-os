import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { getSupabaseEnv } from './lib/supabase/env'

function isCronPath(pathname: string) {
  return pathname.startsWith('/api/cron/')
}

function isPublicPath(pathname: string) {
  return pathname === '/about' || pathname === '/pricing' || pathname === '/admin' || pathname.startsWith('/auth')
}

function isMfaPath(pathname: string) {
  return pathname === '/auth/mfa'
}

function createCspNonce() {
  return Buffer.from(crypto.randomUUID()).toString('base64')
}

function applySecurityPolicy(response: NextResponse, nonce: string) {
  const csp = [
    "default-src 'self'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "img-src 'self' data: blob: https://*.supabase.co https://tiles.openfreemap.org https://opengeo.ncep.noaa.gov",
    "connect-src 'self' https://*.supabase.co https://api.weather.gov https://api.capout.ai https://*.rapidapi.com https://tiles.openfreemap.org https://opengeo.ncep.noaa.gov",
    "style-src 'self' 'unsafe-inline'",
    `script-src 'self' 'nonce-${nonce}'`,
    "worker-src 'self' blob:",
  ].join('; ')
  response.headers.set('Content-Security-Policy', csp)
  response.headers.set('Cache-Control', 'no-store, max-age=0')
  return response
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  if (isCronPath(pathname)) return NextResponse.next({ request })

  const nonce = createCspNonce()
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)
  const { url, anonKey } = getSupabaseEnv()

  let response = NextResponse.next({
    request: { headers: requestHeaders },
  })
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request: { headers: requestHeaders } })
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
      },
    },
  })

  const { data: { user } } = await supabase.auth.getUser()
  const isAuthPage = pathname.startsWith('/auth')

  if (!user && !isPublicPath(pathname)) {
    const login = new URL('/auth/login', request.url)
    login.searchParams.set('next', pathname)
    return applySecurityPolicy(NextResponse.redirect(login), nonce)
  }

  if (!user) return applySecurityPolicy(response, nonce)

  if (isMfaPath(pathname)) return applySecurityPolicy(response, nonce)

  if (isAuthPage && pathname !== '/auth/callback' && pathname !== '/auth/reset') {
    return applySecurityPolicy(NextResponse.redirect(new URL('/', request.url)), nonce)
  }

  const { data: privilegedMembership } = await supabase
    .from('workspace_members')
    .select('workspace_id, role')
    .eq('user_id', user.id)
    .in('role', ['owner', 'admin'])
    .limit(1)
    .maybeSingle()

  if (privilegedMembership) {
    const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    if (assurance?.currentLevel !== 'aal2') {
      const mfa = new URL('/auth/mfa', request.url)
      mfa.searchParams.set('next', pathname)
      return applySecurityPolicy(NextResponse.redirect(mfa), nonce)
    }
  }

  return applySecurityPolicy(response, nonce)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon-).*)'],
}
