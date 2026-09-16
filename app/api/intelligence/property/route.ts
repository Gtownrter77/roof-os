import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'
import { scoreProperty } from '../../../../lib/intelligence'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })

  const leadId = request.nextUrl.searchParams.get('leadId')
  if (!leadId) return NextResponse.json({ error: 'leadId is required.' }, { status: 400 })

  const { data: lead } = await supabase.from('leads').select('id,name,address,status').eq('id', leadId).maybeSingle()
  if (!lead) return NextResponse.json({ error: 'Lead not found.' }, { status: 404 })

  const { data: sessions } = await supabase.from('inspection_sessions').select('id').eq('lead_id', leadId)
  const sessionIds = (sessions ?? []).map((row) => row.id)
  const photoRes = sessionIds.length
    ? await supabase.from('inspection_photos').select('id,album').in('inspection_id', sessionIds)
    : { data: [] as { id: string; album: string }[] }
  const photos = photoRes.data ?? []
  const albums = Array.from(new Set(photos.map((photo) => photo.album).filter(Boolean)))

  const [{ count: openTasks }, { count: warrantiesOpen }, passportRes] = await Promise.all([
    supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('lead_id', leadId).eq('status', 'open'),
    supabase.from('warranties').select('id', { count: 'exact', head: true }).eq('lead_id', leadId).in('registration_status', ['not_started', 'packet_ready']),
    supabase.from('roof_passports').select('id').eq('lead_id', leadId).limit(1).maybeSingle(),
  ])

  const result = scoreProperty({
    leadId,
    status: lead.status,
    photoCount: photos.length,
    albums,
    inspectionCount: sessionIds.length,
    openTaskCount: openTasks ?? 0,
    warrantyOpenCount: warrantiesOpen ?? 0,
    hasPassport: Boolean(passportRes.data),
    hasAddress: Boolean(lead.address),
  })

  const { data: workspaceId } = await supabase.rpc('current_workspace_id')
  if (workspaceId) {
    await supabase.from('job_readiness').upsert({
      workspace_id: workspaceId,
      lead_id: leadId,
      score: result.score,
      blockers: result.gaps,
      computed_at: new Date().toISOString(),
    }, { onConflict: 'lead_id' })
  }

  return NextResponse.json({
    property: { id: lead.id, name: lead.name, address: lead.address, status: lead.status },
    intelligence: result,
    disclaimer: 'Human review required. This is a record-completeness score, not a certified inspection or vision model finding.',
  })
}
