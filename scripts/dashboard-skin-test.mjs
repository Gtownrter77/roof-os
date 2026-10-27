import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import {
  DASHBOARD_SKIN_KEY,
  applyDashboardSkin,
  dashboardSkinEnabled,
} from '../lib/theme/dashboard-skin.ts'

const read = (file) => readFileSync(new URL('../' + file, import.meta.url), 'utf8')

// 1. The skin is opt-in and controls presentation, not workspace settings.
assert.equal(dashboardSkinEnabled(), false, 'Professional Mode is the default')
assert.equal(DASHBOARD_SKIN_KEY, 'roofos.theme.dashboard-skin.v1')
const store = new Map()
const events = []
globalThis.document = { documentElement: { dataset: {} } }
globalThis.window = {
  localStorage: {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => store.set(key, value),
  },
  dispatchEvent: (event) => events.push(event.detail),
}
if (typeof globalThis.CustomEvent !== 'function') {
  globalThis.CustomEvent = class CustomEvent extends Event {
    constructor(type, init) { super(type); this.detail = init?.detail }
  }
}
applyDashboardSkin(true)
assert.equal(dashboardSkinEnabled(), true)
assert.equal(document.documentElement.dataset.dashboardSkin, 'storm')
assert.equal(store.get(DASHBOARD_SKIN_KEY), 'storm')
applyDashboardSkin(false)
assert.equal(dashboardSkinEnabled(), false)
assert.equal(document.documentElement.dataset.dashboardSkin, 'professional')
assert.equal(store.get(DASHBOARD_SKIN_KEY), 'professional')
assert.deepEqual(events, ['storm', 'professional'])
window.localStorage.setItem = () => { throw new Error('Blocked storage') }
applyDashboardSkin(true)
assert.equal(document.documentElement.dataset.dashboardSkin, 'storm', 'still switches when storage access is blocked')
assert.equal(dashboardSkinEnabled(), true, 'active skin stays synchronized when storage writes fail')
window.localStorage.getItem = () => { throw new Error('Blocked storage') }
assert.equal(dashboardSkinEnabled(), true, 'blocked reads fall back to active DOM skin')

// 2. Prepaint theme selection, global propagation, accessible controls, old cinema preference.
const layout = read('app/layout.tsx')
assert.ok(layout.includes('roofos.theme.dashboard-skin.v1'))
assert.ok(layout.includes("dataset.dashboardSkin=skin==='storm'?'storm':'professional'"))
assert.ok(layout.includes('<DashboardSkinTheme />'))
assert.ok(layout.includes("import './storm-skin.css'"))
assert.ok(layout.includes('roofos.theme.cinema.v1'), 'original radar atmosphere remains independent')
const toggle = read('components/DashboardSkinToggle.tsx')
assert.ok(toggle.includes('role="switch"'))
assert.ok(toggle.includes('aria-checked={stormOn}'))
assert.ok(toggle.includes('applyDashboardSkin(!stormOn)'))
const listener = read('components/useDashboardSkin.ts')
assert.ok(listener.includes("addEventListener('storage'"))
assert.ok(listener.includes("addEventListener('roofos-dashboard-skin'"))
const shell = read('components/AppShell.tsx')
assert.ok(shell.includes('<DashboardSkinToggle compact'))
assert.ok(shell.includes('roof-app-nav'))
assert.ok(read('app/settings/page.tsx').includes('Dashboard skin'))
assert.ok(read('app/settings/page.tsx').includes('<DashboardSkinToggle'))

// 3. Login presentation changes but password, magic link, recovery and signup remain available.
const login = read('app/auth/login/page.tsx')
assert.ok(login.includes('roof-login-layout-storm'))
assert.ok(login.includes('<DashboardSkinToggle'))
assert.ok(login.includes('LoginWeatherPreview'))
for (const guard of [
  'supabase.auth.signInWithPassword', 'supabase.auth.signInWithOtp',
  'supabase.auth.resetPasswordForEmail', 'enterOwner',
  "router.push(`/auth/signup?", 'safeNextPath',
]) {
  assert.ok(login.includes(guard), `login still provides ${guard}`)
}

// 4. Storm presentation never writes or invents counts and weather.
const dashboard = read('app/page.tsx')
const storm = read('components/StormDashboard.tsx')
for (const table of ['leads', 'inspection_sessions', 'inspection_measurements', 'estimates', 'storm_evidence', 'tasks', 'warranties']) {
  assert.ok(dashboard.includes(`from('${table}')`), `real count query exists for ${table}`)
}
assert.ok(dashboard.includes('if (stormOn) return <StormDashboard'))
assert.ok(dashboard.includes('<WorkspaceWeather variant="hero"'), 'Professional dashboard stays available')
assert.ok(storm.includes('<WorkspaceWeather variant="compact"'), 'Storm Mode uses real weather component')
assert.ok(storm.includes('counts[count] === null'), 'unknown counts must be marked')
assert.ok(storm.includes('No sample job, weather, or revenue numbers'))
assert.doesNotMatch(storm, /\$284K|312 jobs|47 opportunities|Revenue At Risk/)

// 5. The asset, global palette, responsiveness and print rules are present.
const css = read('app/storm-skin.css')
assert.ok(existsSync(new URL('../public/storm-dashboard-bg.png', import.meta.url)))
for (const required of [
  "html[data-dashboard-skin='storm'] body",
  "html[data-dashboard-skin='storm'] .roof-app-nav",
  "html[data-dashboard-skin='storm'] .glass",
  "html[data-dashboard-skin='storm'] .roof-login-page",
  '.storm-command-hero', '.storm-stage-track',
  'prefers-reduced-motion', '@media print',
]) assert.ok(css.includes(required), `missing skin surface: ${required}`)
assert.ok(!css.includes("html[data-dashboard-skin='professional']"), 'professional inherits original styles without overrides')
console.log('dashboard-skin-test: PASS (local persistence, reversible switch, login/auth continuity, live metrics, global CSS, professional fallback)')
