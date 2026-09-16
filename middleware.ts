import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { getSupabaseEnv } from './lib/supabase/env'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })
  const pathname = request.nextUrl.pathname

  // Vercel Cron and authenticated API routes must not bounce to /auth/login.
  if (pathname.startsWith('/api/cron')) {
    return response
  }

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

  const {
    data: { user },
  } = await supabase.auth.getUser()
  const isAuthPage = pathname.startsWith('/auth')
  const isPublic = pathname === '/about' || pathname === '/pricing'

  if (!user && !isAuthPage && !isPublic) {
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }

  if (user && isAuthPage && pathname !== '/auth/callback') {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|public|icon-).*)'],
}
