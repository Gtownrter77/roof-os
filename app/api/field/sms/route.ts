import { NextRequest, NextResponse } from 'next/server'
import twilio from 'twilio'
import { createClient } from '../../../../lib/supabase/server'
import { readJson } from '../../../../lib/api-security'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })

  const parsed = await readJson(request)
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: parsed.status })
  const body = parsed.body as { to?: string; text?: string }
  const to = String(body.to || '').trim()
  const text = String(body.text || '').trim()
  if (!to || !text) return NextResponse.json({ error: 'to and text required' }, { status: 400 })

  const sid = process.env.TWILIO_ACCOUNT_SID?.trim()
  const token = process.env.TWILIO_AUTH_TOKEN?.trim()
  const from = process.env.TWILIO_PHONE_NUMBER?.trim()
  if (!sid || !token || !from) {
    return NextResponse.json({ queued: true, reason: 'Twilio not configured', to, text }, { status: 202 })
  }

  try {
    const client = twilio(sid, token)
    const msg = await client.messages.create({ to, from, body: text })
    return NextResponse.json({ sent: true, sid: msg.sid })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'send failed'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
