import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync('supabase/migrations/057_workspace_feature_flags.sql', 'utf8')
const start = source.indexOf('create or replace function public.create_default_lead_followup()')
const end = source.indexOf('revoke all on function public.create_default_lead_followup()')
assert.ok(start >= 0 && end > start, 'migration 057 must define and harden the lead follow-up trigger')
const fn = source.slice(start, end)

assert.match(fn, /security\s+definer\s+set\s+search_path\s*=\s*''/i, 'SECURITY DEFINER follow-up trigger must use an empty search_path')
assert.ok(fn.includes('enable_auto_followup_tasks'), 'trigger must honor the workspace feature flag')
assert.ok(fn.includes('public.workspace_settings'), 'settings lookup must be schema qualified')
assert.ok(fn.includes('public.automation_rules'), 'automation rule lookup must be schema qualified')
assert.ok(fn.includes('public.tasks'), 'task writes must be schema qualified')
assert.ok(source.slice(end).includes('from public, anon, authenticated'), 'trigger execution must not be directly exposed to API roles')

console.log('production-followup-trigger-test: PASS')
