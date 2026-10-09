import { NextResponse } from 'next/server'
import { processAudioTranscription } from '@/lib/ai/chat-copilot'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const form = await request.formData()
  const file = form.get('file')
  const language = String(form.get('language') || 'en')
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: 'Audio file is required.' }, { status: 400 })
  }
  try {
    const text = await processAudioTranscription(file, language)
    return NextResponse.json({ text, engine: 'faster-whisper', sourced: Boolean(text) })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Transcription failed.'
    return NextResponse.json({ error: message }, { status: 503 })
  }
}
