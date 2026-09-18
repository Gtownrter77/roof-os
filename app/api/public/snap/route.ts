import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  let body: { image?: string }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 }) }
  const image = body.image ?? ''
  if (!image.startsWith('data:image/')) return NextResponse.json({ error: 'A photo is required.' }, { status: 400 })

  const key = process.env.XAI_API_KEY
  if (!key) {
    return NextResponse.json({
      error: 'Vision is not configured. Add XAI_API_KEY on the server. We will not guess an address without it.',
    }, { status: 503 })
  }

  const res = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: process.env.XAI_VISION_MODEL || 'grok-4',
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: 'This is a house photo, often an MLS listing. If you can identify a street address with reasonable confidence, reply JSON only: {"address":"full street city state zip","confidence":"high|medium|low","note":"short"}. If you cannot, reply {"address":"","confidence":"none","note":"could not identify"}. Never invent a street number.' },
          { type: 'image_url', image_url: { url: image, detail: 'high' } },
        ],
      }],
    }),
  })

  if (!res.ok) {
    const detail = await res.text()
    return NextResponse.json({ error: 'Vision did not answer.', detail: detail.slice(0, 300) }, { status: 502 })
  }

  const payload = await res.json()
  const text = payload.choices?.[0]?.message?.content ?? ''
  const match = text.match(/\{[\s\S]*\}/)
  let parsed = { address: '', note: text.slice(0, 200) }
  if (match) {
    try { parsed = { ...parsed, ...JSON.parse(match[0]) } } catch { /* keep text */ }
  }
  return NextResponse.json({
    address: parsed.address || '',
    note: parsed.note || 'Draft only. Verify before we open a file.',
  })
}
