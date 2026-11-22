import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')
const { isApprovedStorageUrl } = await import('../lib/storage-url.ts')

const supabase = 'https://abc123.supabase.co'
const approved = `${supabase}/storage/v1/object/sign/inspection-photos/claim/a.jpg?token=abc`

assert.equal(isApprovedStorageUrl(approved, supabase), true, 'a signed Supabase storage URL is accepted')
assert.equal(isApprovedStorageUrl('https://evil.example/x', supabase), false, 'an unrelated HTTPS origin is rejected')
assert.equal(isApprovedStorageUrl('http://abc123.supabase.co/storage/v1/object/sign/inspection-photos/a.jpg?token=t', supabase), false, 'plain HTTP is rejected')
assert.equal(isApprovedStorageUrl('javascript:alert(1)', supabase), false, 'non-HTTP schemes are rejected')
assert.equal(isApprovedStorageUrl('https://', supabase), false, 'an unparsable URL is rejected')
assert.equal(isApprovedStorageUrl(`${supabase}/storage/v1/object/sign/inspection-photos/a.jpg`, supabase), false, 'a token is required')
assert.equal(isApprovedStorageUrl(`${supabase}/public/other/a.jpg?token=t`, supabase), false, 'only the approved storage prefix is accepted')
assert.equal(isApprovedStorageUrl(undefined, supabase), false, 'non-string input is rejected')

// The route must apply the helper to BOTH persisted URLs and scope the
// optional inspection id to the workspace.
const route = read('../app/api/measurements/drone/route.ts')
assert.match(route, /isApprovedStorageUrl\(assetUrl,/, 'assetUrl must be validated')
assert.match(route, /isApprovedStorageUrl\(body\.thumbnailUrl,/, 'thumbnailUrl must be validated')
assert.match(route, /inspectionId[\s\S]{0,400}\.eq\('workspace_id',\s*workspaceId\)/, 'inspectionId must be workspace-scoped')
assert.match(route, /\.from\('inspection_sessions'\)/, 'inspectionId must be checked against the canonical inspection_sessions table')
assert.doesNotMatch(route, /\.from\('inspections'\)/, 'the nonexistent inspections table must not be queried')

console.log('drone-url-validation-test: PASS (approved storage only, both URLs, inspection scoped)')
