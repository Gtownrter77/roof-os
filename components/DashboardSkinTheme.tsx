'use client'

import { useEffect } from 'react'
import { dashboardSkinEnabled } from '../lib/theme/dashboard-skin'

/** Keeps the global skin in sync when another tab changes its saved preference. */
export default function DashboardSkinTheme() {
  useEffect(() => {
    const sync = () => {
      document.documentElement.dataset.dashboardSkin = dashboardSkinEnabled() ? 'storm' : 'professional'
    }
    sync()
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [])
  return null
}
