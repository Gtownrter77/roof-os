import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const webThemes = readFileSync('lib/theme/collection.ts', 'utf8')
const fieldThemes = readFileSync('apps/field/src/FieldThemeBackground.tsx', 'utf8')
const app = readFileSync('apps/field/App.tsx', 'utf8')

const expected = ['professional', 'tornado', 'storm-command', 'hail', 'lightning', 'after-storm']
for (const id of expected) {
  assert.ok(webThemes.includes(`id: '${id}'`), `web theme missing: ${id}`)
  assert.ok(fieldThemes.includes(`id: '${id}'`), `field theme missing: ${id}`)
}
assert.equal((fieldThemes.match(/id: '/g) || []).length, expected.length, 'field theme collection must not silently add or drop choices')
assert.ok(fieldThemes.includes("FIELD_THEME_STORAGE_KEY = 'roof_os_field_theme'"), 'field theme preference must be device-local')
assert.ok(app.includes('SecureStore.getItemAsync(FIELD_THEME_STORAGE_KEY)'), 'field app must restore the saved theme')
assert.ok(app.includes('SecureStore.setItemAsync(FIELD_THEME_STORAGE_KEY, theme)'), 'field app must persist theme changes')
assert.ok(app.includes('<FieldThemeBackground theme={fieldTheme} />'), 'field app must render the selected background')
assert.ok(app.includes('FieldThemePicker'), 'field app must expose the theme picker')
console.log('field-theme-parity-test: PASS (six current web themes, device-local persistence, native renderer, selector)')
