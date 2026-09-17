import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const app = readFileSync('apps/field/App.tsx', 'utf8')
const nativeDb = readFileSync('apps/field/src/localDb.ts', 'utf8')
const pkg = JSON.parse(readFileSync('apps/field/package.json', 'utf8'))
const migration = readFileSync('supabase/migrations/003_status_history_inspection_photos.sql', 'utf8')
const appConfig = JSON.parse(readFileSync('apps/field/app.json', 'utf8')).expo
assert.equal(pkg.name, 'field')
for (const marker of ['SecureStore', 'signInWithOtp', 'emailRedirectTo', 'exchangeCodeForSession', 'Linking.getInitialURL', 'inspection_photo_queue', 'inspection_sessions', 'inspection_measurements', 'inspection_photos', 'current_workspace_id', 'inspection-photos', 'accessibilityRole="checkbox"']) assert.ok(app.includes(marker), marker)
assert.equal(appConfig.scheme, 'roofos', 'magic-link deep-link scheme')
assert.ok(nativeDb.includes('openDatabaseSync'), 'native SQLite adapter')
for (const marker of ['enable row level security', "bucket_id text not null default 'inspection-photos'", 'public.is_workspace_member(workspace_id)']) assert.ok(migration.includes(marker), marker)
console.log('mobile-release-check: PASS')
