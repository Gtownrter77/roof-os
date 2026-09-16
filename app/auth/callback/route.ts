import { NextResponse } from 'next/server'
import { createClient } from '../../../lib/supabase/server'
import { safeNextPath } from '../../../lib/safe-next'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const next = safeNextPath(url.searchParams.get('next'), url.origin)

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(new URL(next, url.origin))
  }

  return NextResponse.redirect(new URL('/auth/login?error=auth_callback_failed', url.origin))
}
