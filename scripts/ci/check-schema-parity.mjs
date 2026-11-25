#!/usr/bin/env node
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const [manifestPath, appliedPath] = process.argv.slice(2)
assert.ok(manifestPath && appliedPath, 'usage: check-schema-parity.mjs <manifest.json> <applied-versions.txt>')
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
assert.ok(Array.isArray(manifest.kept) && manifest.kept.length > 0, 'manifest.kept must list the applied migration files')
const expected = manifest.kept.map((name) => {
  const match = name.match(/^(\d+)_/)
  assert.ok(match, `manifest migration has no numeric version: ${name}`)
  return match[1]
}).sort()
const applied = readFileSync(appliedPath, 'utf8').split('\n').map((line) => line.trim()).filter(Boolean).sort()
assert.deepEqual(applied, expected, 'applied migration versions differ from the local migration set')
console.log(`check-schema-parity: PASS (${applied.length} migration versions match)`)
