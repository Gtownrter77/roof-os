import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'
import { readJson } from '../../../../lib/api-security'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })

  const parsed = await readJson(request)
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: parsed.status })
  const body = parsed.body as { supplier?: string; lines?: string[] }
  const supplier = String(body.supplier || 'ABC').trim()
  const lines = Array.isArray(body.lines) ? body.lines.map(String) : []
  if (!lines.length) return NextResponse.json({ error: 'lines required' }, { status: 400 })

  const key = process.env.SUPPLIER_API_KEY?.trim()
  if (!key) {
    return NextResponse.json({ queued: true, reason: 'Supplier API not configured', supplier, lines }, { status: 202 })
  }

  return NextResponse.json({ ordered: true, supplier, lines, note: 'Order accepted by stub' })
}
