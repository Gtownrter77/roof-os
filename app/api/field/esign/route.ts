import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'
import { readJson } from '../../../../lib/api-security'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })

  const parsed = await readJson(request)
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: parsed.status })
  const body = parsed.body as { ready?: boolean; total?: number }
  const ready = Boolean(body.ready)
  const total = Number(body.total || 0)
  if (!ready) return NextResponse.json({ error: 'not ready' }, { status: 400 })

  const key = process.env.DOCUSIGN_API_KEY?.trim()
  if (!key) {
    return NextResponse.json({ queued: true, reason: 'DocuSign not configured', total }, { status: 202 })
  }

  return NextResponse.json({ envelope: `env-${Date.now()}`, total, note: 'Envelope created by stub' })
}
