#!/usr/bin/env node
// Deterministic repository reliability check.
// Source-only: no npm install, no DB connection, no network. Target: < 2 seconds.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const results = []
let failed = 0

const read = (path) => readFileSync(join(root, path), 'utf8')
const exists = (path) => existsSync(join(root, path))

function check(id, condition, detail = '') {
  results.push(`${condition ? 'PASS' : 'FAIL'} [${id}]${detail ? ` - ${detail}` : ''}`)
  if (!condition) failed += 1
}

function safeRead(path) {
  try {
    return read(path)
  } catch {
    return ''
  }
}

const reliability = safeRead('.agents/skills/reliability/SKILL.md')
const verification = safeRead('.agents/skills/verification/SKILL.md')
const godMode = safeRead('.agents/skills/god-mode/SKILL.md')
const agents = safeRead('.agents/AGENTS.md')
const cursorRules = safeRead('.cursorrules')

check('skill:reliability', /name:\s*reliability/.test(reliability), '.agents/skills/reliability/SKILL.md')
check('skill:reliability:rules', reliability.includes('source-tested') && reliability.includes('database-tested'), 'explicit test-evidence distinction')
check('skill:verification', /name:\s*verification/.test(verification), '.agents/skills/verification/SKILL.md')
check('skill:verification:evidence', verification.includes('GitHub-hosted') && verification.includes('Supabase'), 'hosted PostgreSQL available, Auth/Storage separate')
check('skill:god-mode', /name:\s*god-mode/.test(godMode), '.agents/skills/god-mode/SKILL.md')
check('god-mode:disabled', /disabled by design/i.test(godMode) && /never disables RLS/i.test(godMode), 'no security bypass')
check('god-mode:script', safeRead('scripts/god-mode-activate.mjs').includes('disabled by design'), 'activation script refuses')
check('agents:extends', agents.includes('AUTOMATION-AGENTS.md'), 'extends existing agent contract')
check('agents:evidence', agents.includes('source-tested') && agents.includes('database-tested'), 'reporting distinction declared')
check('codex:cursorrules', cursorRules.includes('Agent Reliability') && cursorRules.includes('God Mode'), 'Codex compatibility documented')
check('migration:precedent', exists('supabase/migrations/059_estimate_approval_admin_guard.sql'), 'new-migration policy has a precedent')
check('test:estimate-authority', exists('scripts/estimate-approval-authority-test.mjs'), 'approval guard regression test present')
check('env:no-production', process.env.ENV !== 'PRODUCTION', 'refuses production environment')
check('env:no-tracked-dotenv', !exists('.env') || safeRead('.gitignore').includes('.env'), 'no tracked secret file')

console.log('--- reliability-check results ---')
for (const line of results) console.log(line)
console.log(failed === 0 ? `PASS (${results.length} checks)` : `FAIL (${failed}/${results.length} checks)`)
process.exit(failed === 0 ? 0 : 1)
