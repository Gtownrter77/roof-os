import { createClient } from './supabase/server'

export async function checkAiEnabled(settingKey: 'enable_ai_receptionist' | 'enable_inspection_quality_agent' | 'enable_voice_copilot_whisper') {
  const supabase = await createClient()
  const { data: workspaceId } = await supabase.rpc('current_workspace_id')
  
  if (!workspaceId) return false

  const { data, error } = await supabase
    .from('workspace_settings')
    .select(settingKey)
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (error || !data) return true // Default to true if not set
  return data[settingKey]
}
