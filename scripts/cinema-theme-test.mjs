import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const css = readFileSync('app/globals.css', 'utf8')
const layout = readFileSync('app/layout.tsx', 'utf8')
const login = readFileSync('app/auth/login/page.tsx', 'utf8')
const settings = readFileSync('app/settings/page.tsx', 'utf8')
const theme = readFileSync('lib/theme/cinema.ts', 'utf8')

assert.ok(theme.includes('roofos.theme.cinema.v1'), 'theme key must be device-local')
assert.ok(css.includes("html[data-cinema='on']"), 'on state must paint the radar atmosphere')
assert.ok(css.includes("html[data-cinema='off']"), 'off state must exist')
assert.ok(css.includes('#050914'), 'off state is flat black')
assert.ok(layout.includes('roofos.theme.cinema.v1'), 'layout applies the theme before paint')
assert.ok(login.includes('cinema-surface'), 'login uses the cinema surface')
assert.ok(!login.includes('min-h-screen bg-slate-950'), 'login page fill must not be flat slate')
assert.ok(settings.includes('Radar atmosphere'), 'settings has the toggle')
assert.ok(settings.includes('applyCinemaTheme'), 'settings writes the theme')
console.log('cinema-theme-test: PASS')
