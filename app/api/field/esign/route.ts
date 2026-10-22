import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const ready = Boolean(body.ready)
  const total = Number(body.total || 0)
  if (!ready) return NextResponse.json({ error: 'not ready' }, { status: 400 })

  const key = process.env.DOCUSIGN_API_KEY?.trim()
  if (!key) {
    return NextResponse.json({ queued: true, reason: 'DocuSign not configured', total }, { status: 202 })
  }

  return NextResponse.json({ envelope: `env-${Date.now()}`, total, note: 'Envelope created by stub' })
}
