import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { getSupabaseEnv } from './lib/supabase/env'

function isCronPath(pathname: string) {
  return pathname.startsWith('/api/cron/')
}

function isPublicPath(pathname: string) {
  return pathname === '/about' || pathname === '/pricing' || pathname.startsWith('/auth')
}

function isMfaPath(pathname: string) {
  return pathname === '/auth/mfa'
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64')
  const cspHeader = [
    "default-src 'self'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "img-src 'self' data: blob: https://*.supabase.co",
    "connect-src 'self' https://*.supabase.co https://api.weather.gov https://api.capout.ai https://*.rapidapi.com",
    "style-src 'self' 'unsafe-inline'",
    `script-src 'self' 'nonce-${nonce}'`,
  ].join('; ')

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('Content-Security-Policy', cspHeader)

  const secureNextResponse = () => {
    const next = NextResponse.next({ request: { headers: requestHeaders } })
    next.headers.set('Content-Security-Policy', cspHeader)
    return next
  }
  const secureRedirect = (url: URL) => {
    const redirect = NextResponse.redirect(url)
    redirect.headers.set('Content-Security-Policy', cspHeader)
    return redirect
  }

  let response = secureNextResponse()
  const { url, anonKey } = getSupabaseEnv()
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = secureNextResponse()
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
      },
    },
  })

  if (isCronPath(pathname)) return response

  const { data: { user } } = await supabase.auth.getUser()
  const isAuthPage = pathname.startsWith('/auth')

  if (!user && !isPublicPath(pathname)) {
    const login = new URL('/auth/login', request.url)
    login.searchParams.set('next', pathname)
    return secureRedirect(login)
  }

  if (!user) return response

  if (isMfaPath(pathname)) return response

  if (isAuthPage && pathname !== '/auth/callback' && pathname !== '/auth/reset') {
    return secureRedirect(new URL('/', request.url))
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
      return secureRedirect(mfa)
    }
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon-).*)'],
}
