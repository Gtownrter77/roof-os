#!/usr/bin/env node
import assert from 'node:assert/strict'
import { createClient as supabaseCreateClient } from '@supabase/supabase-js'

export async function seedLocalUsers({
  createClient = supabaseCreateClient,
  url,
  serviceRoleKey,
  emails,
  password,
}) {
  assert.ok(url && serviceRoleKey && password, 'url, serviceRoleKey and password are required')
  assert.ok(Array.isArray(emails) && emails.length > 0, 'at least one synthetic email is required')
  const admin = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const results = []
  for (const email of emails) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })
    if (error && !/already registered|already exists|user.*exists/i.test(String(error.message))) throw error
    results.push({ email, id: data?.user?.id ?? null })
  }
  return results
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'ROOF_RLS_USER_A_EMAIL', 'ROOF_RLS_USER_B_EMAIL', 'ROOF_RLS_TEST_PASSWORD']
  for (const name of required) assert.ok(process.env[name], `${name} is required`)
  const results = await seedLocalUsers({
    url: process.env.SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    emails: [process.env.ROOF_RLS_USER_A_EMAIL, process.env.ROOF_RLS_USER_B_EMAIL],
    password: process.env.ROOF_RLS_TEST_PASSWORD,
  })
  console.log(`ci-local-supabase-seed: PASS (${results.length} synthetic users ready)`)
}
