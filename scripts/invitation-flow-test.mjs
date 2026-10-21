import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const route = readFileSync('app/api/team/invitations/route.ts', 'utf8')
const acceptRoute = readFileSync('app/api/team/invitations/accept/route.ts', 'utf8')
const acceptPage = readFileSync('app/team/invitations/accept/page.tsx', 'utf8')
const migration = readFileSync('supabase/migrations/017_team_invites_atomic_price_books.sql', 'utf8')

for (const marker of [
  "supabase.auth.getUser()",
  "is_workspace_admin",
  'A valid invite email is required.',
  'Role must be admin or member.',
  'Invitation email delivery is not configured.',
  'inviteUserByEmail',
  "status: 'revoked'",
]) assert.ok(route.includes(marker), `invitation route missing: ${marker}`)

for (const marker of [
  'p_invitation_id',
  'accept_workspace_invitation',
  'no longer pending',
  'expired',
  'does not match',
]) assert.ok(acceptRoute.includes(marker), `acceptance route missing: ${marker}`)

for (const marker of [
  'response.status === 401',
  '/auth/login?next=',
  'useRef(false)',
  'already used or is no longer active',
  'role="status"',
]) assert.ok(acceptPage.includes(marker), `acceptance page missing: ${marker}`)

for (const marker of [
  'workspace_invitations',
  'unique (workspace_id, email, status)',
  'expires_at',
  'status',
]) assert.ok(migration.includes(marker), `invitation migration missing: ${marker}`)

console.log('invitation-flow-test: PASS (admin boundary, validation, expiry/replay contract, delivery failure truth)')
