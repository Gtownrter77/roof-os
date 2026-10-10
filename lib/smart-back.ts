'use client'

import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime'

/**
 * Prefer real browser history when it stays inside the app.
 * After /auth/enter redirects, history is often useless, so fall back home.
 */
export function smartBack(router: AppRouterInstance, fallback = '/') {
  if (typeof window === 'undefined') {
    router.push(fallback)
    return
  }

  const referrer = document.referrer
  const sameOrigin = Boolean(referrer) && referrer.startsWith(window.location.origin)
  const fromAuth = sameOrigin && /\/auth(\/|$)/.test(new URL(referrer).pathname)

  if (sameOrigin && !fromAuth && window.history.length > 1) {
    router.back()
    return
  }

  router.push(fallback)
}
