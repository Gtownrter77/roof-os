import { NextResponse } from 'next/server'
import { processAudioTranscription } from '../../../../lib/ai/chat-copilot'
import { createClient } from '../../../../lib/supabase/server'
import { loadWorkspaceSettings } from '../../../../lib/workspace-settings'

export const runtime = 'nodejs'

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

  const form = await request.formData()
  const file = form.get('file')
  const language = String(form.get('language') || 'en')
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: 'Audio file is required.' }, { status: 400 })
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
