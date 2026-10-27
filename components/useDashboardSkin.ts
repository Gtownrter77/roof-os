'use client'

import { useEffect, useState } from 'react'
import { dashboardSkinEnabled } from '../lib/theme/dashboard-skin'

/** React subscription to local skin changes, including across browser tabs. */
export function useDashboardSkin() {
  const [stormOn, setStormOn] = useState(false)
  useEffect(() => {
    const sync = () => setStormOn(dashboardSkinEnabled())
    sync()
    window.addEventListener('roofos-dashboard-skin', sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener('roofos-dashboard-skin', sync)
      window.removeEventListener('storage', sync)
    }
  }, [])
  return stormOn
}
