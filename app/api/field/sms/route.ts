import { NextResponse } from 'next/server'
import twilio from 'twilio'

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
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
