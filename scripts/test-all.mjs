import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))

// 79: this used to be a hand-maintained list of 16 gates while package.json
// registered 155, yet printed PASS. Derive the list from the registry so a new
// security gate cannot silently rot, and require every omission to be justified.
const WAIVED = {
  'test:all': 'Recursive entry point: this script is the gate being verified.',
  'test:runtime-smoke': 'Needs a built .next/static and a running production server; required CI runs it after `npm run build`.',
  'test:two-workspace-isolation': 'Needs ROOF_RLS_TEST_NONPROD=true and a real non-production Supabase project; never point it at production.',
}

const extraChecks = [
  ['typecheck', 'npm', ['run', 'typecheck']],
  ['dependency audit', 'npm', ['audit', '--omit=dev', '--audit-level=moderate']],
  ['release check', 'npm', ['run', 'release-check']],
  ['security check', 'npm', ['run', 'verify:security']],
]
const gates = Object.keys(pkg.scripts)
  .filter((name) => name.startsWith('test:') && !(name in WAIVED))
  .sort()
const commands = [...extraChecks, ...gates.map((name) => [name, 'npm', ['run', name]])]

if (process.argv.includes('--list')) {
  console.log(JSON.stringify({ commands: gates, waived: WAIVED, extraChecks: extraChecks.length }))
  process.exit(0)
}

for (const [label, command, args] of commands) {
  console.log(`\n[test-all] ${label}`)
  const result = spawnSync(command, args, { stdio: 'inherit', shell: false })
  if (result.status !== 0) {
    console.error(`[test-all] FAILED: ${label}`)
    process.exit(result.status ?? 1)
  }
}
console.log(`\n[test-all] PASS (${gates.length} registered gates + ${extraChecks.length} build/release checks)`)
