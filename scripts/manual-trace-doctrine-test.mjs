import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')
const workflow = read('../docs/EXACT-WORKFLOW.md')
const ledgerUrl = new URL('../docs/superpowers/plans/2026-11-23-roofr-roofsnap-mashup-ledger.md', import.meta.url)

const OWNER_SKILLS = [
  'using-superpowers',
  'brainstorming',
  'writing-plans',
  'using-git-worktrees',
  'test-driven-development',
  'systematic-debugging',
  'executing-plans',
  'subagent-driven-development',
  'dispatching-parallel-agents',
  'requesting-code-review',
  'receiving-code-review',
  'verification-before-completion',
  'finishing-a-development-branch',
  'writing-skills',
  'diagnosing-superpowers',
]
const HONEST_STATUSES = ['performed', 'blocked', 'not triggered']

// Auto (AI-first) stays the default on the locked path; owner decision (b)
// adds a narrow hand-trace allowance, never a second workflow.
assert.match(workflow, /The AI does this work/, 'Auto path must remain AI-first')
const handTraceLine = workflow.split(/\r?\n/).find((line) => /MAY trace roof geometry by hand/i.test(line))
assert.ok(handTraceLine, 'EXACT-WORKFLOW.md must permit reviewed, server-recomputed hand measurement')
assert.match(handTraceLine, /persisted/i, 'hand-traced polygons must be persisted')
assert.match(handTraceLine, /recomputed on the server/i, 'area must be recomputed on the server')
assert.match(handTraceLine, /reviewed geometry, scale and pitch/i, 'recompute must use reviewed inputs')
assert.match(handTraceLine, /client-supplied area is never authoritative/i, 'client-supplied area must be rejected')

// The amendment is discoverable both as a marker and as an explicit Manual
// allowance, and it cites the dated owner ruling rather than silently changing doctrine.
assert.ok(/EXACT-WORKFLOW\.md:31 amendment|\bManual\b/.test(workflow), 'amendment marker or explicit Manual allowance is required')
assert.match(workflow, /## Amendment \(2026-11-23\)/, 'dated amendment subsection is required')
assert.match(workflow, /owner decision \(b\)/i, 'amendment must cite owner decision (b)')

// The mandatory 15-skill work-package ledger must exist with an honest status
// for every skill in the owner directive, using the AGENTS.md ledger template.
assert.ok(existsSync(ledgerUrl), '15-skill ledger must exist: docs/superpowers/plans/2026-11-23-roofr-roofsnap-mashup-ledger.md')
const ledger = read('../docs/superpowers/plans/2026-11-23-roofr-roofsnap-mashup-ledger.md')
const rows = ledger.split(/\r?\n/)
assert.equal(OWNER_SKILLS.length, 15, 'owner directive lists 15 skills')
for (const skill of OWNER_SKILLS) {
  const row = rows.find((line) => line.includes('`' + skill + '`') && line.includes('| reviewed |'))
  assert.ok(row, `ledger must contain a reviewed template row for ${skill}`)
  assert.ok(
    HONEST_STATUSES.some((status) => row.includes('| ' + status + ' |')),
    `ledger row for ${skill} must carry an explicit performed/blocked/not triggered status`,
  )
}

console.log('manual-trace-doctrine-test: PASS (amended line, dated owner ruling, 15-skill ledger)')
