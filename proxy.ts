import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { getSupabaseEnv } from './lib/supabase/env'

function isCronPath(pathname: string) {
  return pathname.startsWith('/api/cron/')
}

function isPublicPath(pathname: string) {
  return true
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  if (isCronPath(pathname)) return NextResponse.next({ request })

  // Temporary: keep screens reachable while auth URL config is fixed.
  if (pathname.startsWith('/auth') && pathname !== '/auth/callback') {
    return NextResponse.redirect(new URL('/', request.url))
  }

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

  await supabase.auth.getUser()
  void isPublicPath(pathname)
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon-).*)'],
}
