'use client'
import { useEffect, useRef, useState } from 'react'
import { THEMES, type ThemeId, type StoryChapter } from '../lib/theme/collection'
import ThemeScene from './ThemeScene'

const beats: { chapter: StoryChapter; title: string; copy: string }[] = [
  { chapter: 'command', title: 'THE STORM IS COMING.', copy: 'You know what comes next.' },
  { chapter: 'inspection', title: 'GET EYES ON THE ROOF.', copy: 'Every photo. Every measurement. Every detail.' },
  { chapter: 'build', title: 'PUT YOUR CREW IN MOTION.', copy: 'From the first inspection to the last nail.' },
  { chapter: 'closeout', title: 'LEAVE IT STRONGER.', copy: 'Your name. Your work. Their peace of mind.' },
]
export default function ThemeIntro({ theme, onClose, still = false }: { theme: ThemeId; onClose: () => void; still?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [beat, setBeat] = useState(0)
  const label = THEMES.find(t => t.id === theme)!
  useEffect(() => {
    const node = dialog.current
    const previous = document.activeElement as HTMLElement | null
    node?.showModal()
    return () => { node?.close(); if (previous?.isConnected) previous.focus() }
  }, [])
  useEffect(() => {
    if (still || matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const timer = window.setInterval(() => setBeat(v => Math.min(v+1, beats.length-1)), 4000)
    return () => window.clearInterval(timer)
  }, [still])
  return <dialog ref={dialog} onCancel={onClose} onClose={onClose} className={`theme-intro ${still ? 'theme-still' : ''}`} aria-labelledby="theme-intro-title">
    <ThemeScene theme={theme} chapter={beats[beat].chapter} />
    <div className="theme-intro-top"><span>ROOF<span className="text-red-500">/</span>OS</span><button type="button" onClick={onClose} autoFocus>Skip intro <span aria-hidden>↗</span></button></div>
    <div className="theme-intro-copy" key={beat}>
      <p className="theme-eyebrow">{label.name} / {String(beat+1).padStart(2,'0')}</p>
      <h2 id="theme-intro-title">{beats[beat].title}</h2>
      <p>{beats[beat].copy}</p>
      <div className="theme-intro-beats">{beats.map((b,i) => <button type="button" key={b.chapter} aria-label={`Scene ${i+1}: ${b.title}`} aria-pressed={i === beat} onClick={() => setBeat(i)} />)}</div>
      <button type="button" className="theme-action" onClick={onClose}>ENTER ROOF/OS <span aria-hidden>→</span></button>
    </div>
  </dialog>
}
