import { NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'
import { readJson } from '../../../../lib/read-json'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Sign in and verify your work email first.' }, { status: 401 })

  const parsed = await readJson(request, 2048)
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: parsed.status })
  if (Object.keys(parsed.body).some((key) => key !== 'companyDomain')) {
    return NextResponse.json({ error: 'Only companyDomain is accepted.' }, { status: 400 })
  }

  const companyDomain = parsed.body.companyDomain
  if (typeof companyDomain !== 'string' || companyDomain.length > 253) {
    return NextResponse.json({ error: 'Enter your company email domain.' }, { status: 400 })
  }

  const { data, error } = await supabase.rpc('activate_two_hour_workspace_trial', {
    p_company_domain: companyDomain.trim().toLowerCase(),
  })
  if (error) {
    const status = error.code === '23505' ? 409
      : error.code === '22023' ? 400
      : error.code === '28000' ? 401
      : error.code === '42501' ? 403 : 503
    return NextResponse.json({
      error: status === 409
        ? 'This company or account has already used its free trial.'
        : status === 400
          ? 'Use a valid company domain that matches your verified work email.'
          : status === 403
            ? 'An owner workspace is required to activate this trial.'
            : 'Trial activation could not be verified. Please try again later.',
    }, { status })
  }

  return NextResponse.json({ trial: data }, { headers: { 'Cache-Control': 'no-store' } })
}
