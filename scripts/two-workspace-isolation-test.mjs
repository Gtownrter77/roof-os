import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'

const required = [
  'ROOF_RLS_TEST_NONPROD',
  'ROOF_RLS_TEST_CONFIRM',
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'ROOF_RLS_USER_A_EMAIL',
  'ROOF_RLS_USER_A_PASSWORD',
  'ROOF_RLS_USER_B_EMAIL',
  'ROOF_RLS_USER_B_PASSWORD',
]
for (const name of required) assert.ok(process.env[name], `${name} is required`)
assert.equal(process.env.ROOF_RLS_TEST_NONPROD, 'true', 'set ROOF_RLS_TEST_NONPROD=true only for a non-production project')
assert.equal(process.env.ROOF_RLS_TEST_CONFIRM, 'I_UNDERSTAND_SYNTHETIC_DATA', 'explicit synthetic-data confirmation is required')
assert.ok(!/roof-os-lemon\.vercel\.app|\.vercel\.app$/i.test(process.env.SUPABASE_URL), 'refusing to run against a Vercel URL')
assert.notEqual(process.env.ROOF_RLS_USER_A_EMAIL, process.env.ROOF_RLS_USER_B_EMAIL, 'use two dedicated synthetic users')

const namespace = `rls-smoke-${Date.now()}-${crypto.randomUUID()}`
const client = () => createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
const users = [
  { email: process.env.ROOF_RLS_USER_A_EMAIL, password: process.env.ROOF_RLS_USER_A_PASSWORD },
  { email: process.env.ROOF_RLS_USER_B_EMAIL, password: process.env.ROOF_RLS_USER_B_PASSWORD },
]
const contexts = []

async function signIn(credentials) {
  const supabase = client()
  const { data, error } = await supabase.auth.signInWithPassword(credentials)
  assert.ifError(error)
  assert.ok(data.user?.id, 'synthetic user must have an id')
  const workspace = await supabase.rpc('current_workspace_id')
  assert.ifError(workspace.error)
  assert.ok(workspace.data, 'synthetic user must resolve a workspace')
  return { supabase, user: data.user, workspaceId: workspace.data, leadId: null, objectPath: null }
}

async function run() {
  contexts.push(await signIn(users[0]), await signIn(users[1]))
  const [a, b] = contexts
  for (const context of contexts) {
    const { data, error } = await context.supabase.from('leads').insert({
      owner_id: context.user.id,
      workspace_id: context.workspaceId,
      name: `${namespace}-${context.user.id.slice(0, 8)}`,
      address: 'Synthetic Test Address — Never a customer record',
      source: 'rls-smoke-test',
      notes: namespace,
    }).select('id,workspace_id').limit(1).single()
    assert.ifError(error)
    assert.equal(data.workspace_id, context.workspaceId)
    context.leadId = data.id
  }

  const crossRead = await a.supabase.from('leads').select('id,workspace_id').eq('id', b.leadId).limit(1)
  assert.ifError(crossRead.error)
  assert.equal(crossRead.data.length, 0, 'workspace A can read workspace B lead')

  const crossUpdate = await a.supabase.from('leads').update({ notes: 'cross-workspace mutation must be denied' }).eq('id', b.leadId).select('id').limit(1)
  assert.ifError(crossUpdate.error)
  assert.equal(crossUpdate.data.length, 0, 'workspace A can update workspace B lead')

  const object = new TextEncoder().encode(namespace)
  a.objectPath = `${a.workspaceId}/${a.user.id}/${namespace}.txt`
  const upload = await a.supabase.storage.from('inspection-photos').upload(a.objectPath, object, { contentType: 'text/plain', upsert: false })
  assert.ifError(upload.error)
  const crossDownload = await b.supabase.storage.from('inspection-photos').download(a.objectPath)
  assert.ok(crossDownload.error || !crossDownload.data, 'workspace B can read workspace A private object')

  console.log('two-workspace-isolation-test: PASS (synthetic lead reads/writes and private Storage denial)')
}

try {
  await run()
} finally {
  for (const context of contexts) {
    if (context.objectPath) await context.supabase.storage.from('inspection-photos').remove([context.objectPath])
    if (context.leadId) await context.supabase.from('leads').delete().eq('id', context.leadId).eq('workspace_id', context.workspaceId)
    await context.supabase.auth.signOut()
  }
}
