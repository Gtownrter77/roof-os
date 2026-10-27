export const DASHBOARD_SKIN_KEY = 'roofos.theme.dashboard-skin.v1'

export type DashboardSkin = 'storm' | 'professional'

let storageUnavailable = false

/** Per-device visual preference. Never affects weather, jobs, or business records. */
export function dashboardSkinEnabled(): boolean {
  if (typeof window === 'undefined') return false
  if (storageUnavailable) return document.documentElement.dataset.dashboardSkin === 'storm'
  try {
    return window.localStorage.getItem(DASHBOARD_SKIN_KEY) === 'storm'
  } catch {
    storageUnavailable = true
    return document.documentElement.dataset.dashboardSkin === 'storm'
  }
}

export function applyDashboardSkin(enabled: boolean): void {
  if (typeof document === 'undefined') return
  const skin: DashboardSkin = enabled ? 'storm' : 'professional'
  document.documentElement.dataset.dashboardSkin = skin
  try {
    window.localStorage.setItem(DASHBOARD_SKIN_KEY, skin)
    storageUnavailable = false
  } catch {
    // The choice remains active for this tab when storage is unavailable.
    storageUnavailable = true
  }
  window.dispatchEvent(new CustomEvent('roofos-dashboard-skin', { detail: skin }))
}
