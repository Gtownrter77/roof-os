#!/usr/bin/env node
import assert from 'node:assert/strict'
import { createClient as supabaseCreateClient } from '@supabase/supabase-js'

export async function seedLocalUsers({
  createClient = supabaseCreateClient,
  url,
  serviceRoleKey,
  credentials,
}) {
  assert.ok(url && serviceRoleKey, 'url and serviceRoleKey are required')
  assert.ok(Array.isArray(credentials) && credentials.length > 0, 'at least one synthetic credential is required')
  for (const credential of credentials) {
    assert.ok(credential?.email && credential?.password, 'each synthetic credential needs email and password')
  }
  const admin = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const results = []
  for (const { email, password } of credentials) {
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
  console.log(`ci-local-supabase-seed: PASS (${results.length} synthetic users ready)`)
}
