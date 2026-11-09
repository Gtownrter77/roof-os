import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'
import { readJson } from '../../../../lib/api-security'
import { processChatCopilot, type ChatMessage } from '../../../../lib/ai/chat-copilot'
import { describeFills, fillPageFields, type PageField } from '../../../../lib/ai/page-filler'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })

  // Bounded JSON reading per security standards
  const parsed = await readJson(request)
  if ('error' in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: parsed.status })
  }

  const body = parsed.body as {
    message?: unknown
    history?: unknown
    currentPath?: unknown
    fields?: unknown
  }

  const message = typeof body.message === 'string' ? body.message : ''
  const currentPath = typeof body.currentPath === 'string' ? body.currentPath : '/'
  const rawHistory = Array.isArray(body.history) ? body.history : []

  const history: ChatMessage[] = rawHistory
    .filter((item): item is { role: string; content: string } => {
      return (
        item &&
        typeof item === 'object' &&
        (item.role === 'user' || item.role === 'assistant') &&
        typeof item.content === 'string'
      )
    })
    .map((item) => ({
      role: item.role as 'user' | 'assistant',
      content: item.content.slice(0, 1000),
    }))
    .slice(-8)

  const fields: PageField[] = Array.isArray(body.fields)
    ? body.fields
        .filter((item): item is { key: string; label: string; value?: string; type?: string } => {
          return Boolean(item && typeof item === 'object' && typeof item.key === 'string' && typeof item.label === 'string')
        })
        .slice(0, 40)
        .map((item) => ({
          key: item.key.slice(0, 80),
          label: item.label.slice(0, 120),
          value: typeof item.value === 'string' ? item.value.slice(0, 200) : '',
          type: typeof item.type === 'string' ? item.type.slice(0, 40) : 'text',
        }))
    : []

  const fills = fillPageFields(message, fields)

  try {
    const result = await processChatCopilot({
      message,
      history,
      currentPath,
    })

    return NextResponse.json({
      ...result,
      fills,
      reply: fills.length ? describeFills(fills, fields) : result.reply,
      authenticated: Boolean(user),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Chat service unavailable'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
