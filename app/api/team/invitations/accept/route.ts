import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../../lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })

  let body: { invitationId?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const invitationId = body.invitationId?.trim()
  if (!invitationId || !/^[0-9a-f-]{36}$/i.test(invitationId)) {
    return NextResponse.json({ error: 'A valid invitationId is required.' }, { status: 400 })
  }

  const { data, error } = await supabase.rpc('accept_workspace_invitation', {
    p_invitation_id: invitationId,
  })
  if (error) {
    const message = error.message.toLowerCase()
    const status = message.includes('not found') || message.includes('no longer pending') || message.includes('expired') || message.includes('does not match') ? 409 : 403
    return NextResponse.json({ error: error.message }, { status })
  }

  const membership = Array.isArray(data) ? data[0] : data
  return NextResponse.json({
    membership,
    acceptedBy: user.id,
  })
}
