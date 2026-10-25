import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../../lib/supabase/server'
import { isUuid } from '../../../../../lib/api-security'

export const runtime = 'nodejs'

async function authorize(passportId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { response: NextResponse.json({ error: 'Authentication required.' }, { status: 401 }) }

  if (!isUuid(passportId)) {
    return { response: NextResponse.json({ error: 'passportId must be a valid UUID.' }, { status: 400 }) }
  }

  const { data: passport } = await supabase
    .from('roof_passports')
    .select('id, workspace_id, public_token')
    .eq('id', passportId)
    .limit(1)
    .maybeSingle()

  if (!passport) return { response: NextResponse.json({ error: 'Passport not found.' }, { status: 404 }) }

  const { data: isAdmin, error: roleError } = await supabase.rpc('is_workspace_admin', { target_workspace: passport.workspace_id })
  if (roleError) return { response: NextResponse.json({ error: 'Authorization could not be verified.' }, { status: 503 }) }
  if (isAdmin !== true) return { response: NextResponse.json({ error: 'Workspace administrator access is required to share a passport.' }, { status: 403 }) }

  return { supabase, passport }
}

export async function POST(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const auth = await authorize(id)
  if ('response' in auth) return auth.response
  const { supabase, passport } = auth

  const { data, error } = await supabase
    .from('roof_passports')
    .update({ public_shared: true, public_shared_at: new Date().toISOString() })
    .eq('id', passport.id)
    .select('public_token')
    .single()

  if (error) return NextResponse.json({ error: 'Passport could not be published.', detail: error.message }, { status: 502 })
  return NextResponse.json({ shared: true, token: data.public_token, path: `/passport/share/${data.public_token}` })
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const auth = await authorize(id)
  if ('response' in auth) return auth.response
  const { supabase, passport } = auth

  const { error } = await supabase
    .from('roof_passports')
    .update({ public_shared: false })
    .eq('id', passport.id)

  if (error) return NextResponse.json({ error: 'Passport could not be unpublished.', detail: error.message }, { status: 502 })
  return NextResponse.json({ shared: false })
}
