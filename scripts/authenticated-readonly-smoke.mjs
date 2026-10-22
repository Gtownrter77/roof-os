import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'

const required = [
  'ROOF_RLS_TEST_NONPROD',
  'ROOF_RLS_TEST_CONFIRM',
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'STAGING_PROJECT_REF',
  'ROOF_RLS_USER_A_EMAIL',
  'ROOF_RLS_USER_A_PASSWORD',
  'ROOF_RLS_USER_B_EMAIL',
  'ROOF_RLS_USER_B_PASSWORD',
]
for (const name of required) assert.ok(process.env[name], `${name} is required`)
assert.equal(process.env.ROOF_RLS_TEST_NONPROD, 'true')
assert.equal(process.env.ROOF_RLS_TEST_CONFIRM, 'I_UNDERSTAND_SYNTHETIC_DATA')
assert.ok(!/roof-os-lemon\.vercel\.app|\.vercel\.app$/i.test(process.env.SUPABASE_URL))
assert.ok(process.env.SUPABASE_URL.includes(process.env.STAGING_PROJECT_REF), 'staging project reference must match URL')

const credentials = [
  { email: process.env.ROOF_RLS_USER_A_EMAIL, password: process.env.ROOF_RLS_USER_A_PASSWORD },
  { email: process.env.ROOF_RLS_USER_B_EMAIL, password: process.env.ROOF_RLS_USER_B_PASSWORD },
]
const clients = []
try {
  for (const credential of credentials) {
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
    const { data: auth, error: authError } = await supabase.auth.signInWithPassword(credential)
    assert.ifError(authError)
    assert.ok(auth.user?.id)
    const { data: workspaceId, error: workspaceError } = await supabase.rpc('current_workspace_id')
    assert.ifError(workspaceError)
    assert.ok(workspaceId)
    const { error: workspaceReadError } = await supabase.from('workspaces').select('id').eq('id', workspaceId).limit(1)
    assert.ifError(workspaceReadError)
    const { error: leadReadError } = await supabase.from('leads').select('id,workspace_id').limit(1)
    assert.ifError(leadReadError)
    const { error: storageReadError } = await supabase.storage.from('inspection-photos').list(`${workspaceId}/`, { limit: 1 })
    assert.ifError(storageReadError)
    clients.push(supabase)
  }
  console.log('authenticated-readonly-smoke: PASS (two staging users, workspace resolution, bounded reads, private Storage listing)')
} finally {
  await Promise.all(clients.map((supabase) => supabase.auth.signOut().catch(() => {})))
}
