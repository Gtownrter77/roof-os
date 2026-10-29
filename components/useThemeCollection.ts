'use client'
import { useEffect, useState } from 'react'
import { readThemePreferences, normalizeThemePreferences, paintThemePreferences, THEME_EVENT, type ThemePreferences } from '../lib/theme/collection'
export function useThemeCollection() {
  const [preferences, setPreferences] = useState<ThemePreferences>(() => normalizeThemePreferences(null))
  useEffect(() => {
    const sync = () => { const p = readThemePreferences(); paintThemePreferences(p); setPreferences(p) }
    sync()
    window.addEventListener(THEME_EVENT, sync)
    window.addEventListener('roofos-dashboard-skin', sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(THEME_EVENT, sync)
      window.removeEventListener('roofos-dashboard-skin', sync)
      window.removeEventListener('storage', sync)
    }
  }, [])
  return preferences
}
