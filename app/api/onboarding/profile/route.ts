import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'
import { readJson } from '../../../../lib/api-security'
import {
  ONBOARDING_PROFILE_VERSION,
  validateOnboardingProfile,
  type OnboardingProfileStatus,
} from '../../../../lib/onboarding-profile'

async function getContext() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, user: null, workspaceId: null }
  const { data: workspaceId, error } = await supabase.rpc('current_workspace_id')
  return { supabase, user, workspaceId: error ? null : workspaceId }
}

export async function GET() {
  const { supabase, user, workspaceId } = await getContext()
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  if (!workspaceId) return NextResponse.json({ error: 'No active workspace is available.' }, { status: 404 })

  const { data: isAdmin, error: roleError } = await supabase.rpc('is_workspace_admin', { target_workspace: workspaceId })
  if (roleError) return NextResponse.json({ error: 'Workspace authorization could not be verified.' }, { status: 503 })

  const { data, error } = await supabase
    .from('workspace_onboarding_profiles')
    .select('profile,status,schema_version,updated_at,completed_at')
    .eq('workspace_id', workspaceId)
    .maybeSingle()
  if (error) return NextResponse.json({ error: 'Could not load onboarding profile.' }, { status: 502 })
  return NextResponse.json({
    profile: data?.profile ?? {},
    status: data?.status ?? 'draft',
    schemaVersion: data?.schema_version ?? ONBOARDING_PROFILE_VERSION,
    updatedAt: data?.updated_at ?? null,
    completedAt: data?.completed_at ?? null,
    canEdit: isAdmin === true,
  })
}

export async function PUT(request: NextRequest) {
  const { supabase, user, workspaceId } = await getContext()
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  if (!workspaceId) return NextResponse.json({ error: 'No active workspace is available.' }, { status: 404 })

  const { data: isAdmin, error: roleError } = await supabase.rpc('is_workspace_admin', { target_workspace: workspaceId })
  if (roleError) return NextResponse.json({ error: 'Workspace authorization could not be verified.' }, { status: 503 })
  if (isAdmin !== true) return NextResponse.json({ error: 'Workspace administrator access is required.' }, { status: 403 })

  const parsed = await readJson(request)
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: parsed.status })
  const body = parsed.body as Record<string, unknown>
  if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ error: 'Request body must be an object.' }, { status: 400 })
  if (Object.keys(body).some((key) => !['profile', 'status'].includes(key))) {
    return NextResponse.json({ error: 'Request contains an unsupported field.' }, { status: 400 })
  }

  const validated = validateOnboardingProfile(body.profile)
  if (!validated.profile) return NextResponse.json({ error: validated.error ?? 'Invalid onboarding profile.' }, { status: 400 })
  const status = body.status ?? 'draft'
  if (status !== 'draft' && status !== 'completed') return NextResponse.json({ error: 'Status must be draft or completed.' }, { status: 400 })
  if (status === 'completed' && (!validated.profile.companyType || validated.profile.companyType === 'unsure' || !validated.profile.primaryGoal?.trim())) {
    return NextResponse.json({ error: 'Choose Residential, Commercial, or Both and describe your first goal before completing setup.' }, { status: 400 })
  }

  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('workspace_onboarding_profiles')
    .upsert({
      workspace_id: workspaceId,
      profile: validated.profile,
      status: status as OnboardingProfileStatus,
      schema_version: ONBOARDING_PROFILE_VERSION,
      updated_by: user.id,
      updated_at: now,
      completed_at: status === 'completed' ? now : null,
    }, { onConflict: 'workspace_id' })
    .select('profile,status,schema_version,updated_at,completed_at')
    .single()

  if (error) return NextResponse.json({ error: 'Could not save onboarding profile.' }, { status: 502 })
  return NextResponse.json({ saved: true, ...data })
}
