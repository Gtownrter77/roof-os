#!/usr/bin/env node
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { copyFileSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join, parse, resolve } from 'node:path'

// Local Supabase replays every numeric-prefix migration. This repository has
// three known, locked legacy collisions whose duplicate files contain identical
// SQL. Build a temporary workdir with one copy of each statement so a fresh
// local database can replay the full history without changing production
// migration names. Any drift in the collision set fails closed.
const [sourceArg, targetArg] = process.argv.slice(2)
assert.ok(sourceArg && targetArg, 'usage: prepare-local-migrations.mjs <source-root> <target-workdir>')
const sourceRoot = resolve(sourceArg)
const targetRoot = resolve(targetArg)
assert.notEqual(sourceRoot, targetRoot, 'target workdir must differ from the source repository')
assert.notEqual(targetRoot, parse(targetRoot).root, 'target workdir must not be a filesystem root')

const config = readFileSync(join(sourceRoot, 'supabase', 'config.toml'), 'utf8')
const migrationDir = join(sourceRoot, 'supabase', 'migrations')
const names = readdirSync(migrationDir).filter((name) => name.endsWith('.sql')).sort()

const versions = new Map()
for (const name of names) {
  const match = name.match(/^(\d+)_/)
  assert.ok(match, `migration has no numeric version prefix: ${name}`)
  versions.set(match[1], [...(versions.get(match[1]) ?? []), name].sort())
}
const canonical = (value) => Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)))
const collisions = canonical(Object.fromEntries([...versions].filter(([, entries]) => entries.length > 1)))
const expectedCollisions = canonical({
  '021': ['021_agent_runs_idempotency_contract.sql', '021_photo_estimate_workflows.sql'],
  '022': ['022_photo_estimate_workflows.sql', '022_soffit_measurement_fields.sql'],
  '023': ['023_photo_refresh_decisions.sql', '023_soffit_measurement_fields.sql'],
})
assert.deepEqual(collisions, expectedCollisions, 'known legacy migration collisions changed')

const byHash = new Map()
for (const name of names) {
  const hash = createHash('sha256').update(readFileSync(join(migrationDir, name))).digest('hex')
  byHash.set(hash, [...(byHash.get(hash) ?? []), name].sort())
}
const duplicateGroups = [...byHash.values()].filter((entries) => entries.length > 1).sort((a, b) => a[0].localeCompare(b[0]))
const expectedDuplicateGroups = [
  ['021_photo_estimate_workflows.sql', '022_photo_estimate_workflows.sql'],
  ['022_soffit_measurement_fields.sql', '023_soffit_measurement_fields.sql'],
  ['023_photo_refresh_decisions.sql', '024_photo_refresh_decisions.sql'],
]
assert.deepEqual(duplicateGroups, expectedDuplicateGroups, 'known duplicate migration SQL changed')

const removed = [
  '021_photo_estimate_workflows.sql',
  '022_soffit_measurement_fields.sql',
  '023_photo_refresh_decisions.sql',
]
for (const name of removed) {
  const group = duplicateGroups.find((entries) => entries.includes(name))
  assert.ok(group, `expected duplicate group for ${name}`)
  assert.equal(group.filter((entry) => entry !== name).length, 1, `expected exactly one kept copy for ${name}`)
}
const kept = names.filter((name) => !removed.includes(name))
const keptVersions = new Set()
for (const name of kept) {
  const version = name.match(/^(\d+)_/)[1]
  assert.ok(!keptVersions.has(version), `temporary workdir still has duplicate version ${version}`)
  keptVersions.add(version)
}

rmSync(join(targetRoot, 'supabase'), { recursive: true, force: true })
rmSync(join(targetRoot, 'ci-migration-manifest.json'), { force: true })
mkdirSync(join(targetRoot, 'supabase', 'migrations'), { recursive: true })
writeFileSync(join(targetRoot, 'supabase', 'config.toml'), config)
for (const name of kept) copyFileSync(join(migrationDir, name), join(targetRoot, 'supabase', 'migrations', name))
writeFileSync(join(targetRoot, 'ci-migration-manifest.json'), `${JSON.stringify({ removed, kept }, null, 2)}\n`)
console.log(`prepare-local-migrations: ${kept.length} unique migrations, ${removed.length} identical legacy duplicates omitted`)
