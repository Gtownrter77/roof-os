import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { getSupabaseEnv } from './lib/supabase/env'

function isCronPath(pathname: string) {
  return pathname.startsWith('/api/cron/')
}

function isPublicPath(pathname: string) {
  return pathname === '/about' || pathname === '/pricing' || pathname === '/offer' || pathname === '/request-estimate' || pathname === '/snap' || pathname === '/legal' || pathname.startsWith('/auth') || pathname.startsWith('/api/public/')
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  if (isCronPath(pathname)) {
    return NextResponse.next({ request })
  }

  let response = NextResponse.next({ request })
  const { url, anonKey } = getSupabaseEnv()
  const supabase = createServerClient(
    url,
    anonKey,
    {
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
    },
  )

  const { data: { user } } = await supabase.auth.getUser()
  const isAuthPage = pathname.startsWith('/auth')

  if (!user && !isPublicPath(pathname)) {
    const login = new URL('/auth/login', request.url)
    login.searchParams.set('next', pathname)
    return NextResponse.redirect(login)
  }

  if (user && isAuthPage && pathname !== '/auth/callback') {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon-).*)'],
}
