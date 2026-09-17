import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const env = readFileSync('.env.example', 'utf8')
const deployment = readFileSync('DEPLOYMENT.md', 'utf8')
const eas = JSON.parse(readFileSync('apps/field/eas.json', 'utf8'))
const expo = JSON.parse(readFileSync('apps/field/app.json', 'utf8')).expo
for (const key of ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'CAPOUT_API_KEY', 'RAPIDAPI_KEY', 'CRON_SECRET', 'EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_ANON_KEY', 'EXPO_PUBLIC_WEB_APP_URL']) assert.ok(env.includes(key), key)
for (const key of ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'CRON_SECRET', 'EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_ANON_KEY']) assert.ok(deployment.includes(key), key)
assert.equal(eas.build.preview.distribution, 'internal')
assert.equal(eas.build.preview.android.buildType, 'apk')
assert.equal(expo.android.package, 'com.roofos.field')
console.log('production-env-check: PASS')
