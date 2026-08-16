import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const auth = request.cookies.get('auth') || request.headers.get('authorization')
  const isAuthPage = request.nextUrl.pathname.startsWith('/auth')
  const isOnboarding = request.nextUrl.pathname.startsWith('/onboarding')
  const isPublic = ['/', '/about', '/pricing'].includes(request.nextUrl.pathname)

  if (!auth && !isAuthPage && !isPublic && !isOnboarding) {
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }

  if (auth && isAuthPage) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|public|icon-).*)',
  ],
}
