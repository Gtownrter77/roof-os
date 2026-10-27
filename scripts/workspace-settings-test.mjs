import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  FEATURE_FLAG_ENFORCEMENT,
  WORKSPACE_FEATURE_FLAG_KEYS,
  defaultWorkspaceSettings,
  readWorkspaceSettings,
} from '../lib/workspace-settings.ts'
import { isWithinQuietHours, normalizeStrictE164 } from '../lib/outbound-policy.ts'

const root = new URL('..', import.meta.url).pathname
const read = (path) => readFileSync(join(root, path), 'utf8')

// 1. Every owner toggle is persisted on the workspace settings row.
const migration = read('supabase/migrations/057_workspace_feature_flags.sql')
for (const flag of WORKSPACE_FEATURE_FLAG_KEYS) {
  assert.ok(migration.includes(`${flag} boolean not null default true`), `migration 055 must persist ${flag}`)
}
assert.ok(migration.includes('receptionist_payment_links add column if not exists expires_at'), 'payment link expiry must be recorded on the ledger')

// 2. The settings API stores the flags, returns merged defaults, and requires administration to write.
const settingsRoute = read('app/api/settings/route.ts')
assert.ok(settingsRoute.includes('WORKSPACE_FEATURE_FLAG_KEYS'), 'the settings route must persist the flag registry')
assert.ok(settingsRoute.includes('is_workspace_admin'), 'the settings route must require workspace administration to write')
assert.ok(settingsRoute.includes('readWorkspaceSettings'), 'the settings route must return the merged settings')
assert.ok(settingsRoute.includes('No supported setting was supplied.'), 'the settings route must reject an empty write')

// 3. Every flag declares what it does, and every declared surface really reads the flag.
for (const flag of WORKSPACE_FEATURE_FLAG_KEYS) {
  const entry = FEATURE_FLAG_ENFORCEMENT[flag]
  assert.ok(entry, `${flag} must declare enforcement metadata`)
  assert.ok(typeof entry.note === 'string' && entry.note.trim().length > 0, `${flag} must explain its behavior`)
  if (!entry.enforced) {
    assert.equal(entry.surfaces.length, 0, `${flag} is saved only and must not claim an enforcement surface`)
    continue
  }
  assert.ok(entry.surfaces.length > 0, `${flag} must declare at least one enforcement surface`)
  for (const surface of entry.surfaces) {
    assert.ok(existsSync(join(root, surface)), `${flag} enforcement surface must exist: ${surface}`)
    assert.ok(read(surface).includes(flag), `${surface} must read ${flag}`)
  }
}

// 4. The settings screen labels every toggle and marks the saved-only ones.
const settingsPage = read('app/settings/page.tsx')
assert.ok(settingsPage.includes('FEATURE_FLAG_ENFORCEMENT'), 'the settings screen must use the shared enforcement metadata')
assert.ok(settingsPage.includes('Saved only'), 'the settings screen must mark flags that are only stored')
assert.ok(settingsPage.includes('Enforced'), 'the settings screen must mark flags that are enforced')
for (const flag of WORKSPACE_FEATURE_FLAG_KEYS) {
  assert.ok(settingsPage.includes(`flag="${flag}"`), `the settings screen must label ${flag}`)
}

// 5. Saving the settings screen must not wipe the owner labor rate book.
assert.ok(settingsPage.includes('rates: laborRates'), 'the settings screen must send the loaded labor rates')
assert.ok(!settingsPage.includes('rates: {}'), 'the settings screen must not save an empty labor rate book')
const laborRates = read('app/api/pricing/labor-rates/route.ts')
assert.ok(laborRates.includes('currentLaborItems'), 'the labor rate save must carry the current labor rates forward')
assert.ok(laborRates.includes('items.length > 0 ? items :'), 'the labor rate save must reuse current labor items when no rates are sent')
const weather = read('components/WorkspaceWeather.tsx')
assert.ok(weather.includes('JSON.stringify({ default_zipcode: zip })'), 'the weather widget must not overwrite other workspace settings')

// 6. The manual retailer refresh honors the workspace cadence.
const refresh = read('app/api/pricing/refresh/route.ts')
assert.ok(refresh.includes("price_refresh_frequency === 'disabled'"), 'manual retailer refresh must respect a disabled cadence')
assert.ok(refresh.includes('is_workspace_admin'), 'manual retailer refresh must require workspace administration')

// 7. Defaults, coercion, quiet hours, and phone normalization behave as documented.
const defaults = defaultWorkspaceSettings()
assert.equal(defaults.price_refresh_frequency, 'weekly')
assert.equal(defaults.default_language, 'en-US')
assert.equal(defaults.material_search_mode, 'catalog_and_retailer')
for (const flag of WORKSPACE_FEATURE_FLAG_KEYS) assert.equal(defaults[flag], true, `${flag} must default to on`)

const merged = readWorkspaceSettings({ enable_ai_receptionist: false, default_language: 'es-US', preferred_brands: { shingles: 'GAF' } })
assert.equal(merged.enable_ai_receptionist, false)
assert.equal(merged.enable_canvassing_lead_auto_convert, true, 'a missing flag must fall back to the documented default')
assert.equal(merged.default_language, 'es-US')
assert.deepEqual(merged.preferred_brands, { shingles: 'GAF' })
assert.equal(readWorkspaceSettings(null).enable_ai_receptionist, true)
assert.equal(readWorkspaceSettings({ enable_ai_receptionist: 'yes' }).enable_ai_receptionist, true, 'a non-boolean flag must fall back to the default')

assert.equal(isWithinQuietHours(new Date('2026-10-22T12:00:00')), true)
assert.equal(isWithinQuietHours(new Date('2026-10-22T07:59:00')), false)
assert.equal(isWithinQuietHours(new Date('2026-10-22T19:59:00')), true)
assert.equal(isWithinQuietHours(new Date('2026-10-22T20:00:00')), false)

assert.equal(normalizeStrictE164('(555) 123-4567'), '+15551234567')
assert.equal(normalizeStrictE164('1-555-123-4567'), '+15551234567')
assert.equal(normalizeStrictE164('+1 (555) 123-4567'), '+15551234567')
assert.equal(normalizeStrictE164('555-1234'), null)
assert.equal(normalizeStrictE164('+44 20 7123 4567'), null)
assert.equal(normalizeStrictE164(''), null)

// 8. The Golden Report gates stay closed by default and stay openable.
const reportRoute = read('app/api/photo-estimate/report/route.ts')
assert.ok(reportRoute.includes('require_photo_completeness_report_gate'), 'the report route must read the completeness gate')
assert.ok(reportRoute.includes('require_technician_signature_signoff'), 'the report route must read the signature gate')
assert.ok(reportRoute.includes('isTechnicianSignature'), 'the report route must validate the captured signature')

console.log(`workspace-settings-test: PASS (${WORKSPACE_FEATURE_FLAG_KEYS.length} owner toggles, ${Object.values(FEATURE_FLAG_ENFORCEMENT).filter((entry) => entry.enforced).length} enforced)`)
