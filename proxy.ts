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
  if (isCronPath(pathname)) return NextResponse.next({ request })

  let response = NextResponse.next({ request })
  const { url, anonKey } = getSupabaseEnv()
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
      },
    },
  })

  const { data: { user } } = await supabase.auth.getUser()
  const isAuthPage = pathname.startsWith('/auth')

  if (!user && !isPublicPath(pathname)) {
    const login = new URL('/auth/login', request.url)
    login.searchParams.set('next', pathname)
    return NextResponse.redirect(login)
  }

  if (!user) return response

  if (isMfaPath(pathname)) return response

  if (isAuthPage && pathname !== '/auth/callback' && pathname !== '/auth/reset') {
    return NextResponse.redirect(new URL('/', request.url))
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
      return NextResponse.redirect(mfa)
    }
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon-).*)'],
}
