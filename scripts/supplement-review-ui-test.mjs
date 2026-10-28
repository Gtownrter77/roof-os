import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')

const page = read('../app/supplement/review/page.tsx')
const listRoute = read('../app/api/supplements/review/route.ts')
const detailRoute = read('../app/api/supplements/review/[id]/route.ts')
const migration = read('../supabase/migrations/060_supplement_specialist_agent5.sql')

// 1. The page is a client review surface with explicit owner/admin language.
assert.match(page, /^'use client'/m)
assert.ok(page.includes('Supplement review'))
assert.ok(page.includes('Owner / admin only to approve'))
assert.ok(page.includes('can_approve'), 'the page hides approval unless the API says so')
assert.ok(page.includes("canApprove && selected.status === 'ready_for_review'"), 'approval only for open drafts')
assert.ok(page.includes('Read-only: workspace owner or admin approval is required.'))

// 2. Evidence is visible: proposals, deltas, sources, totals, uncertainty, exclusions.
for (const marker of [
  'proposals',
  'carrier_evidence',
  'contractor_evidence',
  'quantity_delta',
  'amount_delta',
  'carrier_source_total',
  'contractor_total',
  'uncertainty',
  'excluded',
]) {
  assert.ok(page.includes(marker), `the page shows ${marker}`)
}

// 3. Review-only. No insurer, email, export, or payment path in the UI.
assert.ok(page.includes('does not contact an insurer'))
assert.ok(page.includes('Nothing was submitted to an insurer or exported.'))
assert.ok(!/\bmailto:|sendgrid|resend\.com|twilio|capout|\.esx\b/i.test(page), 'no insurer, email, or ESX path in the UI')
assert.ok(!/<form[^>]+action=/i.test(page), 'the UI posts only through the internal API')
const fetchTargets = [...page.matchAll(/fetch\(`?'?([^`'")]+)/g)].map((match) => match[1])
assert.ok(fetchTargets.length > 0, 'the page fetches through the internal API')
assert.ok(fetchTargets.every((target) => target.startsWith('/api/supplements/review')), `unexpected fetch target: ${fetchTargets.join(', ')}`)

// 4. The list route is workspace-scoped, member-only, and metadata-only.
assert.ok(listRoute.includes('requireWorkspaceMember'), 'list requires workspace membership')
assert.ok(listRoute.includes(".eq('workspace_id', workspaceId)"), 'list filters by the current workspace')
assert.ok(listRoute.includes(".select('id,document_id,revision,status,created_at,approved_at,packet')"), 'list loads bounded metadata')
assert.ok(listRoute.includes('function draftSummary(packet: unknown)'), 'list summarizes instead of returning every packet')
assert.ok(listRoute.includes('can_approve: isAdmin === true'))
assert.ok(listRoute.includes('external_submission: false'))
assert.ok(listRoute.includes('limit(50)'))
assert.ok(!/\.delete\(|\.upsert\(/.test(listRoute), 'list never deletes or upserts')

// 5. The detail route denies cross-workspace access and is owner/admin-only for review.
assert.ok(detailRoute.includes('isUuid(id)'), 'detail validates the id')
assert.ok(detailRoute.includes('requireWorkspaceMember'), 'detail requires workspace membership')
assert.equal((detailRoute.match(/\.eq\('workspace_id', workspaceId\)/g) ?? []).length >= 2, true,
  'detail scopes reads and writes to the current workspace')
assert.ok(detailRoute.includes('Supplement review draft not found.'), 'foreign or missing drafts share one 404')
assert.ok(detailRoute.includes('is_workspace_admin'), 'review requires workspace admin authority')
assert.ok(detailRoute.includes("status: body.status"))
assert.ok(detailRoute.includes('approved_by: body.status ===') && detailRoute.includes('approved_at: body.status ==='),
  'approval metadata is set only for approved')
assert.ok(detailRoute.includes(".eq('status', 'ready_for_review')") && detailRoute.includes("if (existing.status !== 'ready_for_review')"),
  'terminal drafts cannot be reviewed twice')
assert.ok(detailRoute.includes('external_submission: false'))
assert.ok(detailRoute.includes('export_blocked: true'))
assert.ok(!/fetch\(|axios|https?:\/\//i.test(detailRoute), 'detail performs no outbound call')
assert.ok(!/\.delete\(/.test(detailRoute), 'review history is never deleted through the API')
assert.ok(!/sendgrid|resend|twilio|mailto|capout|\.esx\b/i.test(detailRoute), 'no insurer or email path in the API')
assert.ok(!/packet:\s*body|packet:\s*parsed/.test(detailRoute), 'review never rewrites the packet')

// 6. The database contract already enforces approval, immutability, and cross-workspace denial.
assert.ok(migration.includes('supplement_review_drafts_update'))
assert.ok(migration.includes('public.is_workspace_admin(workspace_id)'))
assert.ok(migration.includes('An approved supplement review is immutable'))
assert.ok(migration.includes('Append-only history: no delete policy is created.'))
assert.ok(!/for delete/i.test(migration), 'no delete policy')
const pgAssertions = read('../scripts/ci/supplement-specialist-assertions.sql')
assert.ok(pgAssertions.includes('cross-workspace draft visible'), 'real PostgreSQL asserts cross-workspace denial')
assert.ok(pgAssertions.includes('member approval denial'), 'real PostgreSQL asserts member approval denial')

// 7. CI wiring.
const pkg = JSON.parse(read('../package.json'))
assert.equal(pkg.scripts['test:supplement-review-ui'], 'node scripts/supplement-review-ui-test.mjs')
const ci = read('../.github/workflows/ci.yml')
assert.ok(ci.includes('npm run test:supplement-review-ui'), 'required web job runs the review UI contract')

console.log('supplement-review-ui-test: PASS (owner-only UI, evidence visible, workspace-scoped API, cross-workspace 404, no insurer/export path, DB contract referenced, CI wiring)')
