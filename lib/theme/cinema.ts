export const CINEMA_THEME_KEY = 'roofos.theme.cinema.v1'

export function cinemaThemeEnabled() {
  if (typeof window === 'undefined') return true
  return window.localStorage.getItem(CINEMA_THEME_KEY) !== 'off'
}

export function applyCinemaTheme(enabled: boolean) {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.cinema = enabled ? 'on' : 'off'
  window.localStorage.setItem(CINEMA_THEME_KEY, enabled ? 'on' : 'off')
  window.dispatchEvent(new CustomEvent('roofos-cinema-theme', { detail: enabled }))
}
