import { existsSync, readFileSync, writeFileSync } from 'node:fs'

const evidencePath = process.argv[2] || 'docs/evidence/release-gates.json'
const outputPath = process.argv[3]
const gateNames = [
  'repositoryChecks',
  'stagingMigration',
  'authenticatedReadOnly',
  'stagingRls',
  'stagingHeartbeat',
  'physicalDevice',
  'backupRestore',
  'schemaParity',
  'workerRuntime',
  'providerExecution',
]
const statuses = new Set(['PASS', 'FAIL', 'UNKNOWN'])
let evidence = {}
if (existsSync(evidencePath)) evidence = JSON.parse(readFileSync(evidencePath, 'utf8'))
const gates = Object.fromEntries(gateNames.map((name) => [name, statuses.has(evidence[name]) ? evidence[name] : 'UNKNOWN']))
const releaseDecision = Object.values(gates).every((status) => status === 'PASS') ? 'GO' : 'NO-GO'
const lines = [
  '# ROOF/OS release-gate summary',
  '',
  `**Release decision: ${releaseDecision}**`,
  '',
  'Generated from local evidence files only.',
  '',
  '| Gate | Status |',
  '| --- | --- |',
  ...Object.entries(gates).map(([name, status]) => `| ${name} | ${status} |`),
  '',
  'UNKNOWN means evidence was not supplied. It is not a pass and must not be marketed as verified.',
  'This report reads local evidence only; it performs no network request, provider call, secret read, or database write.',
  '',
]
const report = lines.join('\n')
if (outputPath) writeFileSync(outputPath, report)
else process.stdout.write(report)
