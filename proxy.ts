import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { getSupabaseEnv } from './lib/supabase/env'

const SKIP_ENTER_COOKIE = 'roof_os_skip_enter'

function isCronPath(pathname: string) {
  return pathname.startsWith('/api/cron/')
}

function isAuthUtilityPath(pathname: string) {
  return (
    pathname.startsWith('/auth')
    || pathname === '/about'
    || pathname === '/pricing'
    || pathname === '/admin'
    || pathname === '/api/status'
  )
}

function wantsHtml(request: NextRequest) {
  const accept = request.headers.get('accept') || ''
  return accept.includes('text/html')
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
  const skipEnter = request.cookies.get(SKIP_ENTER_COOKIE)?.value === '1'
    || request.nextUrl.searchParams.has('enter_error')

  // Leave the login page out of the flow: bounce it straight into owner enter.
  if ((pathname === '/auth/login' || pathname === '/auth/signup') && !skipEnter) {
    const enter = new URL('/auth/enter', request.url)
    const next = request.nextUrl.searchParams.get('next')
    if (next) enter.searchParams.set('next', next)
    return applySecurityPolicy(NextResponse.redirect(enter), nonce)
  }

  if (
    !user
    && !skipEnter
    && !isAuthUtilityPath(pathname)
    && wantsHtml(request)
    && !pathname.startsWith('/api/')
  ) {
    const enter = new URL('/auth/enter', request.url)
    enter.searchParams.set('next', pathname + request.nextUrl.search)
    return applySecurityPolicy(NextResponse.redirect(enter), nonce)
  }

  // App routes stay reachable without a prior login page. Owner session is
  // established by /auth/enter. MFA remains optional at /auth/mfa.
  return applySecurityPolicy(response, nonce)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon-).*)'],
}
