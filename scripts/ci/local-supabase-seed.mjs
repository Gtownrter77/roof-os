#!/usr/bin/env node
import assert from 'node:assert/strict'
import { createClient as supabaseCreateClient } from '@supabase/supabase-js'

const LOCAL_URL = /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:\d+)?\/?$/i

export async function seedLocalUsers({
  createClient = supabaseCreateClient,
  url,
  serviceRoleKey,
  credentials,
}) {
  assert.match(String(url ?? ''), LOCAL_URL, 'synthetic seeding is only allowed against a local Supabase URL')
  assert.ok(serviceRoleKey, 'serviceRoleKey is required')
  assert.ok(Array.isArray(credentials) && credentials.length > 0, 'at least one synthetic credential is required')
  for (const credential of credentials) {
    assert.ok(credential?.email && credential?.password, 'each synthetic credential needs email and password')
  }
  const admin = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: listed, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (listError) throw listError
  const idsByEmail = new Map((listed?.users ?? []).map((user) => [user.email, user.id]))

  const results = []
  for (const { email, password } of credentials) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })
    if (error && !/already registered|already exists|user.*exists/i.test(String(error.message))) throw error
    const userId = data?.user?.id ?? idsByEmail.get(email)
    assert.ok(userId, `could not resolve synthetic user id for ${email}`)

    // New accounts start with trial_status='pending' (migration 086), which
    // current_workspace_id() deliberately refuses. Synthetic fixtures must be
    // activated or the RLS evidence gates would check a locked workspace.
    const activated = await admin
      .from('workspaces')
      .update({ trial_status: 'active', trial_expires_at: null })
      .eq('created_by', userId)
      .eq('trial_status', 'pending')
      .select('id')
    assert.ifError(activated.error)
    let workspaceId = activated.data?.[0]?.id
    if (!workspaceId) {
      const existing = await admin
        .from('workspaces')
        .select('id')
        .eq('created_by', userId)
        .eq('trial_status', 'active')
        .is('trial_expires_at', null)
        .limit(1)
      assert.ifError(existing.error)
      workspaceId = existing.data?.[0]?.id
    }
    assert.ok(workspaceId, `no active workspace for synthetic user ${email}`)
    results.push({ email, id: userId, workspaceId })
  }
  return results
}

if (import.meta.url === `file://${process.argv[1]}`) {
  for (const name of ['ROOF_RLS_TEST_NONPROD', 'ROOF_RLS_TEST_CONFIRM']) {
    assert.ok(process.env[name], `${name} is required`)
  }
  assert.equal(process.env.ROOF_RLS_TEST_NONPROD, 'true', 'synthetic seeding requires explicit non-production mode')
  assert.equal(process.env.ROOF_RLS_TEST_CONFIRM, 'I_UNDERSTAND_SYNTHETIC_DATA', 'explicit synthetic-data confirmation is required')
  const required = [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'ROOF_RLS_USER_A_EMAIL',
    'ROOF_RLS_USER_A_PASSWORD',
    'ROOF_RLS_USER_B_EMAIL',
    'ROOF_RLS_USER_B_PASSWORD',
  ]
  for (const name of required) assert.ok(process.env[name], `${name} is required`)
  const results = await seedLocalUsers({
    url: process.env.SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    credentials: [
      { email: process.env.ROOF_RLS_USER_A_EMAIL, password: process.env.ROOF_RLS_USER_A_PASSWORD },
      { email: process.env.ROOF_RLS_USER_B_EMAIL, password: process.env.ROOF_RLS_USER_B_PASSWORD },
    ],
  })
  console.log(`ci-local-supabase-seed: PASS (${results.length} synthetic users activated in local workspaces)`)
}
