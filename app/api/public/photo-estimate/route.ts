import { NextRequest, NextResponse } from 'next/server'

const USER_AGENT = 'ROOF-OS/1.0 (photo-estimate)'
const FEET_PER_METER = 3.28084
const RATE_BETTER = 425
const RATE_BEST = 550
const RATE_RESTORE = 475

function polygonAreaSqM(coords: Array<[number, number]>) {
  if (coords.length < 3) return 0
  const lat0 = coords.reduce((sum, point) => sum + point[1], 0) / coords.length
  const scaleX = 111320 * Math.cos(lat0 * Math.PI / 180)
  const scaleY = 110540
  const projected = coords.map(([lon, lat]) => [lon * scaleX, lat * scaleY] as [number, number])
  let area = 0
  for (let i = 0; i < projected.length; i += 1) {
    const [x1, y1] = projected[i]
    const [x2, y2] = projected[(i + 1) % projected.length]
    area += x1 * y2 - x2 * y1
  }
  return Math.abs(area) / 2
}

function visionTarget() {
  const url = process.env.LLAMA_VISION_URL || process.env.LLAMA_API_URL
  const key = process.env.LLAMA_API_KEY || process.env.GROQ_API_KEY || ''
  const model = process.env.LLAMA_VISION_MODEL || 'llama-4-scout'
  if (url) return { url: url.replace(/\/$/, '') + (url.includes('/chat/completions') ? '' : '/v1/chat/completions'), key, model, vendor: 'llama' }
  if (process.env.GROQ_API_KEY) return { url: 'https://api.groq.com/openai/v1/chat/completions', key: process.env.GROQ_API_KEY, model: process.env.LLAMA_VISION_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct', vendor: 'groq-llama' }
  if (process.env.XAI_API_KEY) return { url: 'https://api.x.ai/v1/chat/completions', key: process.env.XAI_API_KEY, model: process.env.XAI_VISION_MODEL || 'grok-4', vendor: 'xai-fallback' }
  return null
}

async function visionAddress(image: string) {
  const target = visionTarget()
  if (!target) return { address: '', note: 'No Llama endpoint configured. Set LLAMA_VISION_URL or GROQ_API_KEY.' }
  const res = await fetch(target.url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(target.key ? { authorization: `Bearer ${target.key}` } : {}),
    },
    body: JSON.stringify({
      model: target.model,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: 'House photo, often MLS. JSON only {"address":"street city state zip"} or {"address":""}. Do not invent a street number.' },
          { type: 'image_url', image_url: { url: image, detail: 'high' } },
        ],
      }],
    }),
  })
  if (!res.ok) return { address: '', note: `${target.vendor} vision HTTP ${res.status}` }
  const payload = await res.json()
  const text = payload.choices?.[0]?.message?.content ?? ''
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return { address: '', note: text.slice(0, 160) }
  try {
    const parsed = JSON.parse(match[0])
    return { address: String(parsed.address || ''), note: `${target.vendor} draft` }
  } catch {
    return { address: '', note: 'vision parse failed' }
  }
}

async function measure(address: string) {
  const geoUrl = new URL('https://nominatim.openstreetmap.org/search')
  geoUrl.searchParams.set('q', address)
  geoUrl.searchParams.set('format', 'jsonv2')
  geoUrl.searchParams.set('limit', '1')
  const geoRes = await fetch(geoUrl, { headers: { 'user-agent': USER_AGENT, accept: 'application/json' } })
  if (!geoRes.ok) throw new Error('geocode failed')
  const geo = await geoRes.json()
  if (!geo[0]) throw new Error('address not found')
  const latitude = Number(geo[0].lat)
  const longitude = Number(geo[0].lon)
  const query = `[out:json][timeout:15];(way(around:35,${latitude},${longitude})[building];);out geom;`
  const overpass = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': USER_AGENT },
    body: new URLSearchParams({ data: query }).toString(),
  })
  if (!overpass.ok) throw new Error('overpass failed')
  const osm = await overpass.json()
  const footprints = (osm.elements ?? []).map((element: any) => {
    const coords = (element.geometry ?? []).map((point: any) => [Number(point.lon), Number(point.lat)] as [number, number])
    return Math.round(polygonAreaSqM(coords) * FEET_PER_METER * FEET_PER_METER)
  }).filter((ft: number) => ft > 200).sort((a: number, b: number) => b - a)
  const footprintSqFt = footprints[0] || 0
  const squares = footprintSqFt ? Math.round((footprintSqFt / 100) * 10) / 10 : 0
  return { displayName: geo[0].display_name, latitude, longitude, footprintSqFt, squares }
}

export async function POST(request: NextRequest) {
  let body: { image?: string; address?: string }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 }) }

  let address = body.address?.trim() ?? ''
  let visionNote = 'address supplied'
  if (!address && body.image) {
    const vision = await visionAddress(body.image)
    address = vision.address
    visionNote = vision.note
  }
  if (!address) return NextResponse.json({ error: 'No address from photo.', detail: visionNote }, { status: 422 })

  try {
    const measured = await measure(address)
    const sq = measured.squares
    const estimates = sq ? {
      good: { squares: sq, amount: Math.round(sq * RATE_BETTER * 0.4), label: 'Repair / cap draft' },
      better: { squares: sq, amount: Math.round(sq * RATE_BETTER), label: 'Full reroof mid' },
      best: { squares: sq, amount: Math.round(sq * RATE_BEST), label: 'Full reroof top' },
      restoration: { squares: sq, amount: Math.round(sq * RATE_RESTORE), label: 'Restoration draft' },
    } : null
    return NextResponse.json({
      status: 'draft',
      visionNote,
      address: measured.displayName,
      geocode: { lat: measured.latitude, lon: measured.longitude },
      measure: {
        footprintSqFt: measured.footprintSqFt,
        planViewSquares: sq,
        source: 'OpenStreetMap',
        confidence: 'low',
        note: 'Footprint is not roof surface. Pitch not applied.',
      },
      estimates,
      send: false,
    })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'measure failed', address }, { status: 502 })
  }
}
