export const THEME_COLLECTION_KEY = 'roofos.theme.collection.v1'
export const THEME_EVENT = 'roofos-theme-collection'
export const THEMES = [
  { id: 'professional', name: 'Professional', eyebrow: 'ALL BUSINESS', description: 'Black. Red. White. Your operation, stripped to the essentials.', accent: '#ef3340' },
  { id: 'tornado', name: 'Tornado Alley', eyebrow: 'IN THE PATH', description: 'A rotating wall cloud. A funnel on the ground. You came to work.', accent: '#a3dcad' },
  { id: 'storm-command', name: 'Storm Tracker 11', eyebrow: 'COMMAND THE STORM', description: 'The meteorologist. The command center. Your next move.', accent: '#38c9ff' },
  { id: 'hail', name: 'Hail Core', eyebrow: 'BUILT FOR IMPACT', description: 'Ice hits hard. Your crew hits the ground ready.', accent: '#bba5ff' },
  { id: 'lightning', name: 'Lightning Front', eyebrow: 'CHARGE THE HORIZON', description: 'A towering shelf cloud. Electric skies. No small entrance.', accent: '#73a6ff' },
  { id: 'after-storm', name: 'After the Storm', eyebrow: 'LEAVE IT STRONGER', description: 'Storm rolls out. Crew rolls in. The roof stands tall.', accent: '#ffbd76' },
] as const
export type ThemeId = typeof THEMES[number]['id']
export type ThemePreferences = { theme: ThemeId; lastStorm: Exclude<ThemeId, 'professional'>; sound: boolean; motion: 'auto' | 'reduced' | 'full'; lowPower: boolean; intro: boolean }
const defaults: ThemePreferences = { theme: 'professional', lastStorm: 'storm-command', sound: false, motion: 'auto', lowPower: false, intro: true }
let volatile: ThemePreferences | null = null
let storageBlocked = false
const isTheme = (v: unknown): v is ThemeId => THEMES.some(t => t.id === v)
export function normalizeThemePreferences(value: unknown): ThemePreferences {
  const p = value && typeof value === 'object' ? value as Partial<ThemePreferences> : {}
  return { theme: isTheme(p.theme) ? p.theme : defaults.theme,
    lastStorm: isTheme(p.lastStorm) && (p.lastStorm as string) !== 'professional' ? p.lastStorm : defaults.lastStorm,
    sound: p.sound === true, lowPower: p.lowPower === true, intro: p.intro !== false,
    motion: p.motion === 'reduced' || p.motion === 'full' ? p.motion : 'auto' }
}
/** A corrupt or unknown value is not an explicit choice; preserve valid legacy choices. */
export function hasSavedThemePreference(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const legacy = window.localStorage.getItem('roofos.theme.dashboard-skin.v1')
    if (legacy === 'storm' || legacy === 'professional') return true
    try {
      const value = JSON.parse(window.localStorage.getItem(THEME_COLLECTION_KEY) || 'null')
      return Boolean(value && typeof value === 'object' && isTheme(value.theme))
    } catch { return false }
  } catch { return volatile !== null }
}
export function readThemePreferences(): ThemePreferences {
  if (typeof window === 'undefined') return { ...defaults }
  if (storageBlocked && volatile) {
    const skin = typeof document !== 'undefined' ? document.documentElement.dataset.dashboardSkin : undefined
    return { ...volatile, theme: skin === 'professional' ? 'professional' : skin === 'storm' && volatile.theme === 'professional' ? volatile.lastStorm : volatile.theme }
  }
  try {
    let p = { ...defaults }
    try { p = normalizeThemePreferences(JSON.parse(window.localStorage.getItem(THEME_COLLECTION_KEY) || 'null')) } catch { /* Invalid JSON uses defaults. */ }
    const legacy = window.localStorage.getItem('roofos.theme.dashboard-skin.v1')
    if (legacy === 'professional') p.theme = 'professional'
    else if (legacy === 'storm' && p.theme === 'professional') p.theme = p.lastStorm
    return p
  } catch { return { ...(volatile || defaults) } }
}
export function paintThemePreferences(p: ThemePreferences) {
  if (typeof document === 'undefined') return
  const d = document.documentElement.dataset
  d.roofTheme = p.theme
  d.dashboardSkin = p.theme === 'professional' ? 'professional' : 'storm'
  d.themeMotion = p.motion
  d.themeLowPower = String(p.lowPower)
}
export function applyThemePreferences(value: ThemePreferences) {
  const p = normalizeThemePreferences(value)
  if (p.theme !== 'professional') p.lastStorm = p.theme
  volatile = p
  paintThemePreferences(p)
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(THEME_COLLECTION_KEY, JSON.stringify(p))
    window.localStorage.setItem('roofos.theme.dashboard-skin.v1', p.theme === 'professional' ? 'professional' : 'storm')
    storageBlocked = false
  } catch { storageBlocked = true }
  window.dispatchEvent(new CustomEvent(THEME_EVENT))
  window.dispatchEvent(new CustomEvent('roofos-dashboard-skin', { detail: p.theme === 'professional' ? 'professional' : 'storm' }))
}
export type StoryChapter = 'command' | 'inspection' | 'estimate' | 'build' | 'invoice' | 'closeout'
export function themeForPath(path: string): StoryChapter {
  if (/^\/(inspection|measure|photo)/.test(path)) return 'inspection'
  if (/^\/(estimate|supplement)/.test(path)) return 'estimate'
  if (/^\/(job|production|calendar)/.test(path)) return 'build'
  if (/^\/(invoice|payment)/.test(path)) return 'invoice'
  if (/^\/(warrant|passport)/.test(path)) return 'closeout'
  return 'command'
}
// Runs before React to prevent a saved theme flashing the wrong palette.
export const THEME_BOOTSTRAP = `try{var p={};try{p=JSON.parse(localStorage.getItem('${THEME_COLLECTION_KEY}')||'null')||{}}catch(e){};var ids=${JSON.stringify(THEMES.map(t => t.id))};var t=ids.indexOf(p.theme)>=0?p.theme:'professional';var l=localStorage.getItem('roofos.theme.dashboard-skin.v1');if(l==='professional')t='professional';else if(l==='storm'&&t==='professional')t=ids.indexOf(p.lastStorm)>0?p.lastStorm:'storm-command';var d=document.documentElement.dataset;if(location.pathname==='/auth/login'&&ids.indexOf(p.theme)<0&&l!=='storm'&&l!=='professional')t='storm-command';d.roofTheme=t;d.dashboardSkin=t==='professional'?'professional':'storm';d.themeMotion=p.motion==='reduced'||p.motion==='full'?p.motion:'auto';d.themeLowPower=p.lowPower===true?'true':'false'}catch(e){document.documentElement.dataset.roofTheme='professional'}`
