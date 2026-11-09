import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'
import { readJson } from '../../../../lib/api-security'
import { processChatCopilot } from '../../../../lib/ai/chat-copilot'
import { describeFills, fillPageFields, type PageField } from '../../../../lib/ai/page-filler'
import { readWorkspaceSettings } from '../../../../lib/workspace-settings'
import { agentRefusal } from '../../../../lib/layer-gate'
import type { EmployeeLayer } from '../../../../lib/employee-layers'

// Open-source only. This route handles authentication, permissions, navigation, and deterministic field fill.
// Chat inference runs directly from the user's browser to loopback Ollama; this route calls no model provider.

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
    fields?: unknown
  }

  const message = typeof body.message === 'string' ? body.message : ''
  const { data: isOwner } = await supabase.rpc('is_system_owner')
  const { data: workspaceId } = await supabase.rpc('current_workspace_id')
  let layer: EmployeeLayer | null = null
  if (isOwner === true) {
    layer = 'owner'
  } else if (workspaceId) {
    const { data: member } = await supabase
      .from('workspace_members')
      .select('employee_layer,role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .maybeSingle()
    layer = (member?.employee_layer as EmployeeLayer | null) ?? (member?.role === 'admin' ? 'operations' : 'canvasser')
  }
  const refusal = agentRefusal(layer, message)
  if (refusal) return NextResponse.json({ reply: refusal, fills: [], applied: false })
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
  let yoloMode = false
  if (workspaceId) {
    if (isOwner === true) {
      const { data: settingsRow } = await supabase.from('workspace_settings').select('yolo_mode').eq('workspace_id', workspaceId).maybeSingle()
      yoloMode = readWorkspaceSettings(settingsRow).yolo_mode === true
    }
  }
  const needsApproval = fills.length > 0 && !yoloMode

  try {
    const result = await processChatCopilot({
      message,
    })

    return NextResponse.json({
      ...result,
      fills,
      yoloMode,
      needsApproval,
      reply: fills.length
        ? yoloMode
          ? `${describeFills(fills, fields)} YOLO MODE is on, so this step was applied.`
          : `${describeFills(fills, fields)} Waiting for your approval.`
        : result.reply,
      authenticated: Boolean(user),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Chat service unavailable'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
