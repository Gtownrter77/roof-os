import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const supplier = String(body.supplier || 'ABC').trim()
  const lines = Array.isArray(body.lines) ? body.lines.map(String) : []
  if (!lines.length) return NextResponse.json({ error: 'lines required' }, { status: 400 })

  const key = process.env.SUPPLIER_API_KEY?.trim()
  if (!key) {
    return NextResponse.json({ queued: true, reason: 'Supplier API not configured', supplier, lines }, { status: 202 })
  }

  return NextResponse.json({ ordered: true, supplier, lines, note: 'Order accepted by stub' })
}
