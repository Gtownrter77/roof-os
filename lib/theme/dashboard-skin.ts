export const DASHBOARD_SKIN_KEY = 'roofos.theme.dashboard-skin.v1'

export type DashboardSkin = 'storm' | 'professional'

/** Per-device visual preference. Never affects weather, jobs, or business records. */
export function dashboardSkinEnabled(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(DASHBOARD_SKIN_KEY) === 'storm'
  } catch {
    return document.documentElement.dataset.dashboardSkin === 'storm'
  }
}

export function applyDashboardSkin(enabled: boolean): void {
  if (typeof document === 'undefined') return
  const skin: DashboardSkin = enabled ? 'storm' : 'professional'
  document.documentElement.dataset.dashboardSkin = skin
  try {
    window.localStorage.setItem(DASHBOARD_SKIN_KEY, skin)
  } catch {
    // The choice remains active for this tab when storage is unavailable.
  }
  window.dispatchEvent(new CustomEvent('roofos-dashboard-skin', { detail: skin }))
}
