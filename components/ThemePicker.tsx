'use client'
import Link from 'next/link'
import { useState } from 'react'
import { THEMES, applyThemePreferences, type ThemeId } from '../lib/theme/collection'
import { useThemeCollection } from './useThemeCollection'
import ThemeScene from './ThemeScene'
import ThemeIntro from './ThemeIntro'
import { ARM_SOUND_EVENT } from './useStormSound'

export default function ThemePicker({ compact = false }: { compact?: boolean }) {
  const p = useThemeCollection()
  const [preview, setPreview] = useState<ThemeId | null>(null)
  const [notice, setNotice] = useState('')
  const selected = THEMES.find(t => t.id === p.theme)!
  function apply(theme: ThemeId) {
    applyThemePreferences({ ...p, theme })
    setNotice(`${THEMES.find(t => t.id === theme)!.name} applied on this device.`)
  }
  return <section className={`theme-picker ${compact ? 'theme-picker-compact' : ''}`} aria-label="ROOF/OS theme collection">
    <div className="theme-picker-heading"><div><p className="theme-eyebrow">MAKE AN ENTRANCE</p><h2>YOUR STORM.<br /><span>YOUR ROOF/OS.</span></h2></div><p>Six ways to run the operation. Choose your atmosphere. Keep your edge.</p></div>
    <div className="theme-grid">{THEMES.map((t,i) => <article key={t.id} className={`theme-card ${p.theme === t.id ? 'theme-card-selected' : ''}`} style={{ '--theme-accent': t.accent } as React.CSSProperties}>
      <button className="theme-card-preview" type="button" onClick={() => setPreview(t.id)} aria-label={`Preview ${t.name}`}>
        <ThemeScene theme={t.id} />
        <span className="theme-card-number">0{i+1}</span><span className="theme-preview-label">PLAY PREVIEW ↗</span>
      </button>
      <div className="theme-card-copy"><p className="theme-eyebrow">{t.eyebrow}</p><h3>{t.name}</h3><p>{t.description}</p>
        <button type="button" className="theme-apply" aria-pressed={p.theme === t.id} onClick={() => apply(t.id)}>{p.theme === t.id ? '✓ ACTIVE THEME' : 'APPLY THEME →'}</button>
      </div>
    </article>)}</div>
    <p className="theme-save-status" role="status" aria-live="polite">{notice || `${selected.name} is active. Preferences are saved on this browser.`}</p>
    <fieldset className="theme-options"><legend>RUN IT YOUR WAY</legend>
      <label><span><strong>Opening sequence</strong><small>Once per theme per session. Replay whenever you want.</small></span><input type="checkbox" checked={p.intro} onChange={e => applyThemePreferences({ ...p, intro: e.target.checked })} /></label>
      <label><span><strong>Storm sound</strong><small>Local wind and low-end rumble. Use Play sound to start; mute anytime.</small></span><input type="checkbox" checked={p.sound} onChange={e => { applyThemePreferences({ ...p, sound: e.target.checked }); if (e.target.checked) window.dispatchEvent(new CustomEvent(ARM_SOUND_EVENT)) }} /></label>
      <label><span><strong>Motion</strong><small>Your system’s reduced-motion setting always takes priority.</small></span><select aria-label="Theme motion" value={p.motion} onChange={e => applyThemePreferences({ ...p, motion: e.target.value as typeof p.motion })}><option value="auto">Follow device</option><option value="full">Full motion</option><option value="reduced">Reduced motion</option></select></label>
      <label><span><strong>Low-power mode</strong><small>Still scenery. No sound. Same attitude.</small></span><input type="checkbox" checked={p.lowPower} onChange={e => applyThemePreferences({ ...p, lowPower: e.target.checked })} /></label>
    </fieldset>
    <div className="theme-picker-footer"><button type="button" className="theme-action" onClick={() => window.dispatchEvent(new CustomEvent('roofos-play-trailer'))}>WATCH THE TRAILER WITH SOUND ▶</button><Link href="/radar">OPEN LOCATION RADAR ↗</Link><span>NOAA / NWS radar · Your device location or workspace ZIP</span></div>
    {preview && <ThemeIntro theme={preview} still={p.lowPower || p.motion === 'reduced'} onClose={() => setPreview(null)} />}
  </section>
}
