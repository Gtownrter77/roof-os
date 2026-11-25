import assert from 'node:assert/strict'
import { seedLocalUsers } from './ci/local-supabase-seed.mjs'

function fakeClient({ existingUsers = [], activationRows = 1, existingActiveRows = 0 } = {}) {
  const calls = { createUser: [], update: [], eq: [], is: [], select: [] }
  let mode = 'none'
  const client = {
    auth: {
      admin: {
        async listUsers() {
          return {
            data: { users: existingUsers.map((email) => ({ email, id: `id-${email}` })) },
            error: null,
          }
        },
        async createUser(row) {
          calls.createUser.push(row)
          if (existingUsers.includes(row.email)) {
            return { data: null, error: { message: 'User already registered' } }
          }
          return { data: { user: { id: `id-${row.email}` } }, error: null }
        },
      },
    },
    from(table) {
      assert.equal(table, 'workspaces', 'seeder must activate workspaces through the workspaces table')
      return {
        update(row) {
          calls.update.push(row)
          mode = 'update'
          return this
        },
        eq(column, value) {
          calls.eq.push([column, value])
          return this
        },
        is(column, value) {
          calls.is.push([column, value])
          return this
        },
        limit(value) {
          calls.limit = value
          return this
        },
        select() {
          calls.select.push(mode)
          return this
        },
        then(resolve) {
          const rows = mode === 'update' ? activationRows : existingActiveRows
          mode = 'none'
          resolve({
            data: Array.from({ length: rows }, (_, index) => ({ id: `workspace-${index}` })),
            error: null,
          })
        },
      }
    },
  }
  return { client, calls }
}

{
  const { client, calls } = fakeClient({ existingUsers: ['b@example.test'] })
  const result = await seedLocalUsers({
    createClient: () => client,
    url: 'http://127.0.0.1:54321',
    serviceRoleKey: 'service-role-key',
    credentials: [
      { email: 'a@example.test', password: 'password-a' },
      { email: 'b@example.test', password: 'password-b' },
    ],
  })
  assert.deepEqual(result, [
    { email: 'a@example.test', id: 'id-a@example.test', workspaceId: 'workspace-0' },
    { email: 'b@example.test', id: 'id-b@example.test', workspaceId: 'workspace-0' },
  ])
  assert.deepEqual(calls.createUser.map((c) => c.email), ['a@example.test', 'b@example.test'])
  assert.deepEqual(calls.createUser.map((c) => c.password), ['password-a', 'password-b'])
  assert.ok(calls.createUser.every((c) => c.email_confirm === true))
  assert.equal(calls.update.length, 2, 'both synthetic users must have an activated workspace')
  assert.deepEqual(calls.update[0], { trial_status: 'active', trial_expires_at: null })
  assert.deepEqual(calls.eq, [
    ['created_by', 'id-a@example.test'],
    ['trial_status', 'pending'],
    ['created_by', 'id-b@example.test'],
    ['trial_status', 'pending'],
  ])
}

{
  const { client } = fakeClient()
  client.from = () => { throw new Error('missing workspaces update must fail closed') }
  await assert.rejects(
    seedLocalUsers({
      createClient: () => client,
      url: 'http://127.0.0.1:54321',
      serviceRoleKey: 'y',
      credentials: [{ email: 'a@example.test', password: 'p' }],
    }),
    /workspaces/,
  )
}

{
  const { client } = fakeClient({ activationRows: 0 })
  await assert.rejects(
    seedLocalUsers({
      createClient: () => client,
      url: 'http://127.0.0.1:54321',
      serviceRoleKey: 'y',
      credentials: [{ email: 'a@example.test', password: 'p' }],
    }),
    /active workspace/,
  )
}

{
  const { client, calls } = fakeClient({ activationRows: 0, existingActiveRows: 1 })
  const result = await seedLocalUsers({
    createClient: () => client,
    url: 'http://127.0.0.1:54321',
    serviceRoleKey: 'y',
    credentials: [{ email: 'a@example.test', password: 'p' }],
  })
  assert.equal(result[0].workspaceId, 'workspace-0')
  assert.deepEqual(calls.is, [['trial_expires_at', null]])
}

{
  const createClient = () => { throw new Error('non-local URL must be refused before any client is created') }
  await assert.rejects(
    seedLocalUsers({
      createClient,
      url: 'https://roof-os-lemon.vercel.app',
      serviceRoleKey: 'y',
      credentials: [{ email: 'a@example.test', password: 'p' }],
    }),
    /local/i,
  )
}

{
  const createClient = () => ({
    auth: { admin: { async listUsers() { return { data: null, error: { message: 'database offline' } } } } },
  })
  await assert.rejects(
    seedLocalUsers({
      createClient,
      url: 'http://127.0.0.1:54321',
      serviceRoleKey: 'y',
      credentials: [{ email: 'a@example.test', password: 'p' }],
    }),
    (error) => /database offline/.test(String(error.message)),
  )
}

{
  const createClient = () => { throw new Error('should not be called') }
  await assert.rejects(
    seedLocalUsers({ createClient, url: 'http://127.0.0.1:54321', serviceRoleKey: 'y', credentials: [{ email: 'a@example.test' }] }),
    /password/,
  )
}

console.log('ci-local-supabase-seed-test: PASS (synthetic users activated, local-only, fail-closed)')
