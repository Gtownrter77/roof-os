'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { applyThemePreferences, themeForPath } from '../lib/theme/collection'
import { useThemeCollection } from './useThemeCollection'
import ThemeScene from './ThemeScene'
import ThemeIntro from './ThemeIntro'
import ThemeTrailer from './ThemeTrailer'
import { ARM_SOUND_EVENT, useStormSound } from './useStormSound'

export default function ThemeExperience() {
  const p = useThemeCollection()
  const pathname = usePathname() || '/'
  const [intro, setIntro] = useState(false)
  const [trailer, setTrailer] = useState(false)
  const [osReduced, setOsReduced] = useState(false)
  const [hidden, setHidden] = useState(false)
  const playing = useStormSound({ ...p, sound: p.sound && !trailer })
  const still = osReduced || p.motion === 'reduced' || p.lowPower || hidden
  useEffect(() => {
    const play = () => setTrailer(true)
    window.addEventListener('roofos-play-trailer', play)
    return () => window.removeEventListener('roofos-play-trailer', play)
  }, [])
  useEffect(() => {
    if (pathname !== '/auth/login') return
    try {
      if (!localStorage.getItem('roofos.theme.collection.v1') && !localStorage.getItem('roofos.theme.dashboard-skin.v1')) applyThemePreferences({ ...p, theme: 'storm-command' })
    } catch { /* Existing local theme controls still work when storage is denied. */ }
    // Only initialize the first login visit; never override an explicit choice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => setOsReduced(media.matches)
    const visibility = () => setHidden(document.hidden)
    sync(); visibility()
    media.addEventListener('change', sync); document.addEventListener('visibilitychange', visibility)
    return () => { media.removeEventListener('change', sync); document.removeEventListener('visibilitychange', visibility) }
  }, [])
  useEffect(() => {
    if (p.theme === 'professional' || !p.intro || still || pathname.startsWith('/auth') || pathname === '/themes') return
    try {
      const key = `roofos.intro.seen.${p.theme}`
      if (sessionStorage.getItem(key)) return
      sessionStorage.setItem(key, 'true'); setIntro(true)
    } catch { /* No persistent session marker: do not interrupt navigation repeatedly. */ }
  }, [p.theme, p.intro, still, pathname])
  useEffect(() => {
    if (still || p.theme === 'professional') return
    let frame = 0
    const move = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const world = document.querySelector<HTMLElement>('.theme-world')
        world?.style.setProperty('--camera-x', `${(event.clientX / innerWidth - .5) * 2}deg`)
        world?.style.setProperty('--camera-y', `${(.5 - event.clientY / innerHeight) * 2}deg`)
      })
    }
    window.addEventListener('pointermove', move, { passive: true })
    return () => { cancelAnimationFrame(frame); window.removeEventListener('pointermove', move); const w = document.querySelector<HTMLElement>('.theme-world'); w?.style.removeProperty('--camera-x'); w?.style.removeProperty('--camera-y') }
  }, [still, p.theme])
  if (p.theme === 'professional') return trailer ? <ThemeTrailer muted={p.lowPower} onClose={() => setTrailer(false)} /> : null
  function sound() {
    if (playing) applyThemePreferences({ ...p, sound: false })
    else {
      // Arm after React has installed the listener for any newly enabled preference.
      applyThemePreferences({ ...p, sound: true })
      window.dispatchEvent(new CustomEvent(ARM_SOUND_EVENT))
    }
  }
  return <>
    <div className={`theme-world ${still ? 'theme-still' : ''}`}><ThemeScene theme={p.theme} chapter={themeForPath(pathname)} /></div>
    <nav className={`theme-dock ${pathname.startsWith('/auth') ? 'theme-dock-auth' : ''}`} aria-label="Theme controls">
      <Link href="/themes">Themes</Link>
      <button type="button" onClick={() => setTrailer(true)} title="Watch the trailer with sound">Trailer ▶</button>
      <button type="button" onClick={sound} disabled={p.lowPower} aria-pressed={playing}>{playing ? 'Mute' : 'Play sound'}</button>
    </nav>
    {trailer && <ThemeTrailer muted={p.lowPower} onClose={() => setTrailer(false)} />}
    {intro && !trailer && <ThemeIntro theme={p.theme} still={still} onClose={() => setIntro(false)} />}
  </>
}
