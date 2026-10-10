import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseEnv } from '../supabase/env'

type CookieClient = {
  auth: {
    verifyOtp: (args: { token_hash: string; type: 'magiclink' }) => Promise<{ error: { message: string } | null }>
    signInWithPassword: (args: { email: string; password: string }) => Promise<{ error: { message: string } | null }>
  }
}

/**
 * Mint a real Supabase session for the workspace owner using the service role.
 * Used to reopen the app when the creator is locked out of login/MFA.
 */
export async function establishOwnerSession(cookieClient: CookieClient): Promise<{ ok: true } | { ok: false; reason: string }> {
  const { url } = getSupabaseEnv()
  if (!url || url.includes('placeholder') || url.includes('validation.supabase')) {
    return { ok: false, reason: 'Supabase URL is not configured' }
  }

  const passwordEmail = process.env.OWNER_ENTER_EMAIL?.trim()
  const password = process.env.OWNER_ENTER_PASSWORD?.trim()
  if (passwordEmail && password) {
    const { error } = await cookieClient.auth.signInWithPassword({ email: passwordEmail, password })
    if (!error) return { ok: true }
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!serviceRoleKey) {
    return { ok: false, reason: 'SUPABASE_SERVICE_ROLE_KEY is not configured' }
  }

  const admin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const email = await resolveOwnerEmail(admin)
  if (!email) {
    return { ok: false, reason: 'No owner user found to enter as' }
  }

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  })
  if (linkError || !linkData?.properties?.hashed_token) {
    return { ok: false, reason: linkError?.message || 'Could not generate owner enter link' }
  }

  const { error: otpError } = await cookieClient.auth.verifyOtp({
    token_hash: linkData.properties.hashed_token,
    type: 'magiclink',
  })
  if (otpError) {
    return { ok: false, reason: otpError.message }
  }

  return { ok: true }
}

async function resolveOwnerEmail(admin: SupabaseClient): Promise<string | null> {
  const preferred = process.env.OWNER_ENTER_EMAIL?.trim().toLowerCase()
  if (preferred) return preferred

  const { data: systemOwners } = await admin
    .from('system_owner')
    .select('owner_user_id')
    .limit(1)

  const systemOwnerId = systemOwners?.[0]?.owner_user_id as string | undefined
  if (systemOwnerId) {
    const { data } = await admin.auth.admin.getUserById(systemOwnerId)
    if (data.user?.email) return data.user.email
  }

  const { data: members } = await admin
    .from('workspace_members')
    .select('user_id')
    .eq('role', 'owner')
    .order('created_at', { ascending: true })
    .limit(1)

  const memberId = members?.[0]?.user_id as string | undefined
  if (memberId) {
    const { data } = await admin.auth.admin.getUserById(memberId)
    if (data.user?.email) return data.user.email
  }

  const { data: listed, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 50 })
  if (error || !listed?.users?.length) return null

  const sorted = [...listed.users].sort((a, b) => {
    const aTime = a.created_at ? Date.parse(a.created_at) : 0
    const bTime = b.created_at ? Date.parse(b.created_at) : 0
    return aTime - bTime
  })
  return sorted[0]?.email ?? null
}
