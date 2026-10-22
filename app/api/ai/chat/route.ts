import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'
import { readJson } from '../../../../lib/api-security'
import { processChatCopilot, type ChatMessage } from '../../../../lib/ai/chat-copilot'
import { checkAiEnabled } from '../../../../lib/ai-guard'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!(await checkAiEnabled('enable_voice_copilot_whisper'))) {
    return NextResponse.json({ error: 'AI Chat Copilot is disabled in workspace settings.' }, { status: 403 })
  }

  // Bounded JSON reading per security standards
  const parsed = await readJson(request)

  if ('error' in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: parsed.status })
  }

  const body = parsed.body as {
    message?: unknown
    history?: unknown
    currentPath?: unknown
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

  try {
    const result = await processChatCopilot({
      message,
      history,
      currentPath,
    })

    return NextResponse.json({
      ...result,
      authenticated: Boolean(user),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Chat service unavailable'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
