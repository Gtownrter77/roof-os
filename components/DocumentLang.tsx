'use client'

import { useEffect } from 'react'

// The workspace default language is read after hydration so static pages
// (weather, upsell, warranty) keep their prerendered HTML. The setting takes
// effect as soon as the client mounts.
export default function DocumentLang() {
  useEffect(() => {
    let active = true
    fetch('/api/settings')
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}))
        if (!response.ok || !payload.settings) return
        const language = String(payload.settings.default_language || 'en-US').split('-')[0] || 'en'
        if (active && typeof document !== 'undefined') document.documentElement.lang = language
      })
      .catch(() => undefined)
    return () => { active = false }
  }, [])
  return null
}