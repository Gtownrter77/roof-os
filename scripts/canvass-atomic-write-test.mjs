import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const migration = await readFile(new URL('../supabase/migrations/075_atomic_canvass_knock.sql', import.meta.url), 'utf8')
const page = await readFile(new URL('../app/canvass/page.tsx', import.meta.url), 'utf8')

assert.match(migration, /function public\.log_canvass_knock\(/)
assert.match(migration, /security invoker/i)
assert.match(migration, /public\.current_workspace_id\(\)/)
assert.match(migration, /public\.is_workspace_member\(v_workspace_id\)/)
assert.match(migration, /enable_canvassing_lead_auto_convert/)
assert.match(migration, /pg_advisory_xact_lock\(hashtextextended\(v_workspace_id::text, 0\)\)/)
assert.match(migration, /lower\(regexp_replace\(btrim\(l\.address\)/)
assert.match(migration, /insert into public\.lead_activity/)
assert.match(migration, /revoke all on function public\.log_canvass_knock\(text, text, text, text, text\) from public, anon/i)
assert.match(migration, /grant execute on function public\.log_canvass_knock\(text, text, text, text, text\) to authenticated/i)
assert.match(page, /supabase\.rpc\('log_canvass_knock'/)
assert.doesNotMatch(page, /from\('lead_activity'\)\.insert/)
assert.doesNotMatch(page, /\.limit\(200\)/)
assert.match(page, /setLeadConversionEnabled\(payload\.settings\.enable_canvassing_lead_auto_convert === true\)/)

console.log('canvass-atomic-write-test: PASS')
