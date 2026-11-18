import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'
import { readJson } from '../../../../lib/api-security'
import { searchParallelAnonymous } from '../../../../lib/research/parallel-anonymous'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  const parsed = await readJson(request)
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: parsed.status })
  const body = parsed.body as Record<string, unknown>
  if (!body || typeof body.query !== 'string') {
    return NextResponse.json({ error: 'A research question is required.' }, { status: 400 })
  }
  try {
    const result = await searchParallelAnonymous(body.query)
    return NextResponse.json({ ...result, advisory: true,
      notice: 'Web sources are unverified research leads. Confirm official codes, storm records and manufacturer data before acting.' })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Parallel research unavailable.'
    return NextResponse.json({ error: message, fallback: 'Use the existing BAILEY storm and property research tools.' }, { status: 503 })
  }
}
