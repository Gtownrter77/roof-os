import { spawnSync } from 'node:child_process'

const commands = [
  ['typecheck', 'npm', ['run', 'typecheck']],
  ['dependency audit', 'npm', ['audit', '--omit=dev', '--audit-level=high']],
  ['release check', 'npm', ['run', 'release-check']],
  ['security check', 'npm', ['run', 'verify:security']],
  ['API security', 'npm', ['run', 'test:api-security']],
  ['auth flow', 'npm', ['run', 'test:auth-flow']],
  ['two-workspace contract', 'npm', ['run', 'test:two-workspace-contract']],
  ['mobile auth', 'npm', ['run', 'test:mobile-auth']],
  ['mobile offline sync', 'npm', ['run', 'test:mobile-offline-sync']],
  ['estimate creation', 'npm', ['run', 'test:estimate-creation-flow']],
  ['estimate packet manager gate', 'npm', ['run', 'test:estimate-packet-manager-gate']],
  ['AI chat and transcription', 'npm', ['run', 'test:ai-chat-bar']],
  ['agent runtime', 'npm', ['run', 'test:agent-runtime']],
  ['release evidence', 'npm', ['run', 'test:release-evidence']],
]

for (const [label, command, args] of commands) {
  console.log(`\n[test-all] ${label}`)
  const result = spawnSync(command, args, { stdio: 'inherit', shell: false })
  if (result.status !== 0) {
    console.error(`[test-all] FAILED: ${label}`)
    process.exit(result.status ?? 1)
  }
}
console.log('\n[test-all] PASS')
