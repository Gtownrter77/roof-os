'use client'

import { useEffect } from 'react'
import { cinemaThemeEnabled } from '../lib/theme/cinema'

/** Applies the saved radar atmosphere before paint when the inline script did not run. */
export default function CinemaTheme() {
  useEffect(() => {
    document.documentElement.dataset.cinema = cinemaThemeEnabled() ? 'on' : 'off'
  }, [])
  return null
}
