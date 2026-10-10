import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { establishOwnerSession } from '../../../lib/auth/owner-enter'
import { safeNextPath } from '../../../lib/safe-next'
import { getSupabaseEnv } from '../../../lib/supabase/env'

export async function GET(request: NextRequest) {
  const url = request.nextUrl
  const next = safeNextPath(url.searchParams.get('next'), url.origin)
  const destination = new URL(next, url.origin)

  let response = NextResponse.redirect(destination)
  response.headers.set('Cache-Control', 'no-store, max-age=0')

  const { url: supabaseUrl, anonKey } = getSupabaseEnv()
  const supabase = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options)
        })
      },
    },
  })

  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    return response
  }

  const result = await establishOwnerSession(supabase)
  if (result.ok === false) {
    destination.searchParams.set('enter_error', result.reason.slice(0, 120))
    response = NextResponse.redirect(destination)
    response.headers.set('Cache-Control', 'no-store, max-age=0')
  }

  return response
}
