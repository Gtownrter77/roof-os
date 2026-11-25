import assert from 'node:assert/strict'
import { normalizeEnvOutput } from './ci/normalize-env-output.mjs'

assert.equal(
  normalizeEnvOutput([
    'DB_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"',
    'SUPABASE_URL=http://127.0.0.1:54321',
    'PLAIN=value',
    'EMPTY=""',
    'CRLF="value"\r',
    '',
  ].join('\n')),
  [
    'DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres',
    'SUPABASE_URL=http://127.0.0.1:54321',
    'PLAIN=value',
    'EMPTY=',
    'CRLF=value',
    '',
  ].join('\n'),
)

assert.throws(() => normalizeEnvOutput('NOT_AN_ASSIGNMENT\n'), /invalid GITHUB_ENV line/)
assert.throws(() => normalizeEnvOutput('NAME="unterminated\n'), /unterminated quote/)

console.log('ci-env-normalizer-test: PASS (quoted Supabase status values normalized for GITHUB_ENV)')
