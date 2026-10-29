export const CINEMA_THEME_KEY = 'roofos.theme.cinema.v1'

export function cinemaThemeEnabled() {
  if (typeof window === 'undefined') return true
  try { return window.localStorage.getItem(CINEMA_THEME_KEY) !== 'off' }
  catch { return typeof document === 'undefined' || document.documentElement.dataset.cinema !== 'off' }
}

export function applyCinemaTheme(enabled: boolean) {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.cinema = enabled ? 'on' : 'off'
  try { window.localStorage.setItem(CINEMA_THEME_KEY, enabled ? 'on' : 'off') } catch { /* Keep the visual choice in this tab. */ }
  window.dispatchEvent(new CustomEvent('roofos-cinema-theme', { detail: enabled }))
}
