#!/usr/bin/env node
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// `supabase status -o env` emits DB_URL="postgresql://..." with literal quotes.
// GITHUB_ENV does not interpret those quotes, so pass every line through this
// normalizer before appending it.
export function normalizeEnvOutput(text) {
  return text.split('\n').map((rawLine) => {
    const line = rawLine.replace(/\r$/, '')
    if (!line) return line
    const at = line.indexOf('=')
    assert.ok(at > 0, `invalid GITHUB_ENV line: ${line}`)
    const name = line.slice(0, at)
    assert.match(name, /^[A-Z][A-Z0-9_]*$/, `invalid GITHUB_ENV name: ${name}`)
    const value = line.slice(at + 1)
    if (!value.startsWith('"')) return `${name}=${value}`
    assert.ok(value.endsWith('"') && value.length >= 2, `unterminated quote: ${line}`)
    return `${name}=${value.slice(1, -1)}`
  }).join('\n')
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.stdout.write(normalizeEnvOutput(readFileSync(0, 'utf8')))
}
