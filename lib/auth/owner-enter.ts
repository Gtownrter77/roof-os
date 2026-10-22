import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseEnv } from '../supabase/env'

export { assertOwnerEnterAuthorized } from './owner-enter-gate'

type CookieClient = {
  auth: {
    verifyOtp: (args: { token_hash: string; type: 'magiclink' }) => Promise<{ error: { message: string } | null }>
    signInWithPassword: (args: { email: string; password: string }) => Promise<{ error: { message: string } | null }>
  }
}

/**
 * Mint a real Supabase session for the workspace owner using the service role.
 * Break-glass only — caller must pass assertOwnerEnterAuthorized first.
 */
export async function establishOwnerSession(cookieClient: CookieClient): Promise<{ ok: true } | { ok: false; reason: string }> {
  const { url } = getSupabaseEnv()
  if (!url || url.includes('placeholder') || url.includes('validation.supabase')) {
    return { ok: false, reason: 'enter_misconfigured' }
  }

  const passwordEmail = process.env.OWNER_ENTER_EMAIL?.trim()
  const password = process.env.OWNER_ENTER_PASSWORD?.trim()
  if (passwordEmail && password) {
    const { error } = await cookieClient.auth.signInWithPassword({ email: passwordEmail, password })
    if (!error) return { ok: true }
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!serviceRoleKey) {
    return { ok: false, reason: 'enter_misconfigured' }
  }

  const admin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const email = await resolveOwnerEmail(admin)
  if (!email) {
    return { ok: false, reason: 'enter_no_owner' }
  }

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  })
  if (linkError || !linkData?.properties?.hashed_token) {
    return { ok: false, reason: 'enter_mint_failed' }
  }

  const { error: otpError } = await cookieClient.auth.verifyOtp({
    token_hash: linkData.properties.hashed_token,
    type: 'magiclink',
  })
  if (otpError) {
    return { ok: false, reason: 'enter_mint_failed' }
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

  // Fail closed — never impersonate "oldest Auth user".
  return null
}
