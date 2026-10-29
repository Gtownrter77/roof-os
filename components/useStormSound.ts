'use client'
import { useEffect, useRef, useState } from 'react'
import { readThemePreferences, type ThemePreferences } from '../lib/theme/collection'

export const ARM_SOUND_EVENT = 'roofos-theme-sound-arm'
/** Synthesized locally; AudioContext is created only inside an explicit click event. */
export function useStormSound(preferences: ThemePreferences) {
  const [playing, setPlaying] = useState(false)
  const stopRef = useRef<() => void>(() => {})
  useEffect(() => {
    let context: AudioContext | undefined
    const stop = () => { if (context) { void context.close().catch(() => {}); context = undefined }; setPlaying(false) }
    stopRef.current = stop
    const arm = () => {
      const p = readThemePreferences()
      if (!p.sound || p.lowPower || p.theme === 'professional' || document.hidden) { stop(); return }
      stop()
      try {
        context = new AudioContext()
        const buffer = context.createBuffer(1, context.sampleRate * 3, context.sampleRate)
        const data = buffer.getChannelData(0)
        for (let i=0; i<data.length; i++) data[i] = Math.random()*2-1
        const wind = context.createBufferSource()
        wind.buffer = buffer; wind.loop = true
        const filter = context.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = p.theme === 'tornado' ? 380 : 180
        const volume = context.createGain(); volume.gain.value = .12
        wind.connect(filter).connect(volume).connect(context.destination)
        wind.start()
        const active = context
        void active.resume().then(() => { if (context === active) setPlaying(true) }).catch(stop)
      } catch { stop() }
    }
    const hidden = () => { if (document.hidden) stop() }
    window.addEventListener(ARM_SOUND_EVENT, arm)
    document.addEventListener('visibilitychange', hidden)
    return () => { window.removeEventListener(ARM_SOUND_EVENT, arm); document.removeEventListener('visibilitychange', hidden); stop() }
  }, [])
  useEffect(() => {
    if (!preferences.sound || preferences.lowPower || preferences.theme === 'professional') stopRef.current()
  }, [preferences.sound, preferences.lowPower, preferences.theme])
  useEffect(() => { stopRef.current() }, [preferences.theme])
  return playing
}
