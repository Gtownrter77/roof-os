import { NextResponse } from 'next/server'
import { processAudioTranscription } from '../../../../lib/ai/chat-copilot'
import { createClient } from '../../../../lib/supabase/server'
import { loadWorkspaceSettings } from '../../../../lib/workspace-settings'

export const runtime = 'nodejs'
const MAX_AUDIO_BYTES = 25 * 1024 * 1024
const MAX_LANGUAGE_LENGTH = 32
const AUDIO_TYPES = new Set(['audio/webm', 'audio/wav', 'audio/x-wav', 'audio/mpeg', 'audio/mp4', 'audio/aac', 'application/octet-stream'])

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })

  const { data: workspaceId } = await supabase.rpc('current_workspace_id')
  if (!workspaceId) return NextResponse.json({ error: 'No workspace is configured.' }, { status: 400 })
  const settings = await loadWorkspaceSettings(supabase, workspaceId)
  if (!settings.enable_voice_copilot_whisper) {
    return NextResponse.json({ error: 'The voice copilot is disabled for this workspace.', sourced: false }, { status: 501 })
  }

  const contentLength = request.headers.get('content-length')
  if (contentLength && /^\d+$/.test(contentLength) && Number(contentLength) > MAX_AUDIO_BYTES + 128 * 1024) {
    return NextResponse.json({ error: 'Audio upload exceeds the 25 MB limit.' }, { status: 413 })
  }
  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Audio form data could not be read.' }, { status: 400 })
  }
  const file = form.get('file')
  const language = String(form.get('language') || 'en').trim()
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: 'Audio file is required.' }, { status: 400 })
  }
  if (file.size < 1 || file.size > MAX_AUDIO_BYTES) {
    return NextResponse.json({ error: 'Audio upload must be between 1 byte and 25 MB.' }, { status: 413 })
  }
  if (!AUDIO_TYPES.has(file.type.toLowerCase())) {
    return NextResponse.json({ error: 'Unsupported audio type. Use WebM, WAV, MP3, AAC, or MP4 audio.' }, { status: 415 })
  }
  if (!/^[A-Za-z0-9_-]{1,32}$/.test(language) || language.length > MAX_LANGUAGE_LENGTH) {
    return NextResponse.json({ error: 'Language must be a short BCP-47-style code.' }, { status: 400 })
  }
  try {
    const text = await processAudioTranscription(file, language)
    if (!text) {
      return NextResponse.json({
        error: 'Local Whisper is not configured or did not return a transcript.',
        text: null,
        engine: null,
        sourced: false,
      }, { status: 503 })
    }
    return NextResponse.json({ text, engine: 'faster-whisper', sourced: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Transcription failed.'
    return NextResponse.json({ error: message }, { status: 503 })
  }
}
