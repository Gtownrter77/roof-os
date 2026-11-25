import assert from 'node:assert/strict'
import { seedLocalUsers } from './ci/local-supabase-seed.mjs'

{
  const calls = []
  const createClient = (url, key, options) => {
    assert.equal(url, 'http://127.0.0.1:54321')
    assert.equal(key, 'service-role-key')
    assert.deepEqual(options, { auth: { persistSession: false, autoRefreshToken: false } })
    return {
      auth: {
        admin: {
          async createUser(row) {
            calls.push(row)
            if (row.email === 'b@example.test') return { data: null, error: { message: 'User already registered' } }
            return { data: { user: { id: 'user-a' } }, error: null }
          },
        },
      },
    }
  }
  const result = await seedLocalUsers({
    createClient,
    url: 'http://127.0.0.1:54321',
    serviceRoleKey: 'service-role-key',
    emails: ['a@example.test', 'b@example.test'],
    password: 'synthetic-password',
  })
  assert.deepEqual(result, [
    { email: 'a@example.test', id: 'user-a' },
    { email: 'b@example.test', id: null },
  ])
  assert.deepEqual(calls.map((c) => c.email), ['a@example.test', 'b@example.test'])
  assert.ok(calls.every((c) => c.password === 'synthetic-password' && c.email_confirm === true))
}

{
  const createClient = () => ({
    auth: { admin: { async createUser() { return { data: null, error: { message: 'database offline' } } } } },
  })
  await assert.rejects(
    seedLocalUsers({ createClient, url: 'x', serviceRoleKey: 'y', emails: ['a@example.test'], password: 'p' }),
    (error) => /database offline/.test(String(error.message)),
  )
}

console.log('ci-local-supabase-seed-test: PASS (idempotent synthetic user seeding, fail-closed on real errors)')
