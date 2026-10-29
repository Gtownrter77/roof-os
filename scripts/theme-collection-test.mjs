import assert from 'node:assert/strict'
import { runInNewContext } from 'node:vm'
import { cinemaThemeEnabled, applyCinemaTheme } from '../lib/theme/cinema.ts'
import { THEMES, THEME_COLLECTION_KEY, normalizeThemePreferences, readThemePreferences, applyThemePreferences, themeForPath, hasSavedThemePreference, THEME_BOOTSTRAP } from '../lib/theme/collection.ts'

assert.equal(THEMES.length, 6)
assert.equal(new Set(THEMES.map(t => t.id)).size, 6)
assert.equal(readThemePreferences().theme, 'professional')
for (const invalid of [null, 'tornado', [], { theme: 'unknown', sound: 'yes', lowPower: 1, motion: 'fast' }]) {
  const p = normalizeThemePreferences(invalid)
  assert.equal(p.theme, 'professional')
  assert.equal(p.sound, false)
  assert.equal(p.motion, 'auto')
  assert.equal(p.lowPower, false)
}
const data = new Map()
const events = []
globalThis.document = { documentElement: { dataset: {} } }
globalThis.window = { localStorage: { getItem: k => data.get(k) ?? null, setItem: (k,v) => data.set(k,v) }, dispatchEvent: e => events.push(e.type) }
assert.equal(readThemePreferences().theme, 'professional')
assert.equal(hasSavedThemePreference(), false)
data.set(THEME_COLLECTION_KEY, '{broken')
assert.equal(hasSavedThemePreference(), false, 'corrupt JSON is not an explicit saved choice')
data.set(THEME_COLLECTION_KEY, JSON.stringify({ theme: 'unknown' }))
assert.equal(hasSavedThemePreference(), false, 'unknown theme is not an explicit saved choice')
data.delete(THEME_COLLECTION_KEY)
for (const [raw,legacy,expected] of [['{broken',null,'storm-command'],[JSON.stringify({theme:'professional'}),null,'professional'],['{broken','professional','professional']]) {
 const dom = { documentElement: { dataset:{} } }
 runInNewContext(THEME_BOOTSTRAP,{document:dom,location:{pathname:'/auth/login'},localStorage:{getItem:key=>key===THEME_COLLECTION_KEY?raw:legacy}})
 assert.equal(dom.documentElement.dataset.roofTheme,expected,'prepaint recovers invalid preferences without overriding Professional')
}
data.set('roofos.theme.dashboard-skin.v1', 'storm')
assert.equal(hasSavedThemePreference(), true)
assert.equal(readThemePreferences().theme, 'storm-command', 'legacy storm maps to command center')
applyThemePreferences({ ...readThemePreferences(), theme: 'tornado', sound: true })
assert.equal(readThemePreferences().theme, 'tornado')
assert.equal(document.documentElement.dataset.roofTheme, 'tornado')
assert.equal(document.documentElement.dataset.dashboardSkin, 'storm')
assert.equal(JSON.parse(data.get(THEME_COLLECTION_KEY)).lastStorm, 'tornado')
data.set('roofos.theme.dashboard-skin.v1', 'professional')
assert.equal(readThemePreferences().theme, 'professional')
data.set('roofos.theme.dashboard-skin.v1', 'storm')
assert.equal(hasSavedThemePreference(), true)
assert.equal(readThemePreferences().theme, 'tornado', 'quick toggle restores the chosen storm')
applyThemePreferences({ ...readThemePreferences(), theme: 'professional' })
assert.equal(readThemePreferences().theme, 'professional')
assert.equal(document.documentElement.dataset.dashboardSkin, 'professional')
assert.ok(events.includes('roofos-theme-collection'))
assert.ok(events.includes('roofos-dashboard-skin'))
data.set(THEME_COLLECTION_KEY, '{broken')
assert.doesNotThrow(readThemePreferences)
window.localStorage.setItem = () => { throw Error('denied') }
window.localStorage.getItem = () => { throw Error('denied') }
applyThemePreferences({ ...normalizeThemePreferences(null), theme: 'hail', lowPower: true })
assert.equal(readThemePreferences().theme, 'hail')
assert.equal(document.documentElement.dataset.themeLowPower, 'true')
assert.doesNotThrow(cinemaThemeEnabled, 'legacy cinema reader handles denied storage')
assert.doesNotThrow(() => applyCinemaTheme(false), 'legacy cinema control handles denied storage')
assert.equal(cinemaThemeEnabled(), false)
assert.equal(themeForPath('/inspections/123'), 'inspection')
assert.equal(themeForPath('/estimates/123'), 'estimate')
assert.equal(themeForPath('/jobs/123'), 'build')
assert.equal(themeForPath('/invoices'), 'invoice')
assert.equal(themeForPath('/warranties'), 'closeout')
assert.equal(themeForPath('/settings'), 'command')
console.log('theme-collection-test: PASS (six themes, migration, corrupt-preference/prepaint recovery, storage, compatibility, chapters)')
