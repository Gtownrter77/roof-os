'use client'

import { useEffect, useState } from 'react'

type Props = { step: number }

const messages = [
  'Welcome aboard. I’m your ROOF/OS weather and roofing operations guide. I’ll help you get your workspace ready, one practical step at a time.',
  'Let’s start with the company basics. Your service area helps us put local weather and roofing workflows in the right context.',
  'Every crew works a little differently. Tell me about your work so ROOF/OS can present the right tools and terminology.',
  'Choose the role that best describes your day-to-day work. I’ll tailor the tour to the responsibilities you select.',
  'You’re ready for the next step. You stay in control of every setting and every operational decision.'
]

export default function HologramMeteorologist({ step }: Props) {
  const [speaking, setSpeaking] = useState(false)
  const [visible, setVisible] = useState(true)
  const [speechAvailable, setSpeechAvailable] = useState(false)
  const message = messages[Math.min(Math.max(step - 1, 0), messages.length - 1)]

  useEffect(() => {
    setSpeechAvailable(typeof window !== 'undefined' && 'speechSynthesis' in window)
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }
    }
  }, [])

  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel()
      setSpeaking(false)
    }
  }, [step])

  const speak = () => {
    if (!speechAvailable || typeof window === 'undefined') return
    if (speaking) {
      window.speechSynthesis.cancel()
      setSpeaking(false)
      return
    }
    const utterance = new SpeechSynthesisUtterance(message)
    utterance.rate = 0.96
    utterance.pitch = 0.92
    utterance.onend = () => setSpeaking(false)
    utterance.onerror = () => setSpeaking(false)
    setSpeaking(true)
    window.speechSynthesis.speak(utterance)
  }

  if (!visible) {
    return <button type="button" onClick={() => setVisible(true)} className="w-full max-w-md rounded-xl border border-cyan-300/30 bg-slate-950/80 px-4 py-3 text-left text-sm font-semibold text-cyan-100 hover:bg-cyan-950/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-200">Show your virtual meteorologist</button>
  }

  return (
    <aside className="relative w-full max-w-md overflow-hidden rounded-2xl border border-cyan-300/25 bg-slate-950/80 p-5 shadow-[0_0_45px_rgba(34,211,238,0.12)]" aria-label="Virtual meteorologist onboarding guide">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_20%,rgba(34,211,238,0.17),transparent_62%)]" />
      <div className="relative flex min-h-[270px] flex-col items-center justify-center">
        <div className="absolute right-0 top-0 flex items-center gap-2">
          <span className="rounded-full border border-cyan-300/20 px-2 py-1 text-[10px] uppercase tracking-wider text-cyan-100/60">Weather desk</span>
          <button type="button" onClick={() => { window.speechSynthesis?.cancel(); setSpeaking(false); setVisible(false) }} aria-expanded={visible} className="rounded-md px-2 py-1 text-xs text-cyan-100/70 hover:bg-cyan-300/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-200">Hide guide</button>
        </div>
        <div className="relative mb-4 flex h-44 w-44 items-center justify-center">
          <div aria-hidden="true" className="absolute inset-2 rounded-full border border-cyan-300/20 shadow-[0_0_35px_rgba(34,211,238,0.16)]" />
          <div aria-hidden="true" className="absolute inset-0 rounded-full border border-dashed border-cyan-200/20 motion-safe:animate-[spin_28s_linear_infinite]" />
          <svg viewBox="0 0 160 180" role="img" aria-label="Stylized holographic meteorologist avatar" className="relative h-40 w-36 drop-shadow-[0_0_15px_rgba(34,211,238,0.65)]">
            <defs>
              <linearGradient id="meteorologist-glow" x1="0" x2="1" y1="0" y2="1">
                <stop offset="0%" stopColor="#cffafe" />
                <stop offset="55%" stopColor="#67e8f9" />
                <stop offset="100%" stopColor="#0891b2" />
              </linearGradient>
            </defs>
            <path d="M80 14c-24 0-39 18-39 42 0 17 8 28 19 35-23 9-38 28-40 61h120c-2-33-17-52-40-61 11-7 19-18 19-35 0-24-15-42-39-42Z" fill="url(#meteorologist-glow)" fillOpacity=".16" stroke="url(#meteorologist-glow)" strokeWidth="2.5" />
            <path d="M47 59c8-21 22-31 42-29 12 1 20 8 25 19-17-7-35-5-51 5-5 3-10 5-16 5Z" fill="#a5f3fc" fillOpacity=".65" />
            <path d="M58 68h12m20 0h12M70 68l10 3 10-3" stroke="#cffafe" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M68 91c7 6 17 6 24 0M57 119c14 9 32 9 46 0M80 110v39" stroke="#67e8f9" strokeWidth="2" strokeLinecap="round" fill="none" />
            <path d="M24 151h112M32 160h96" stroke="#22d3ee" strokeOpacity=".45" strokeWidth="2" strokeLinecap="round" />
            <path d="M18 42c8-8 17-12 27-13m70 0c10 1 19 5 27 13" stroke="#a5f3fc" strokeOpacity=".5" fill="none" strokeWidth="2" />
          </svg>
          <span aria-hidden="true" className="absolute bottom-2 h-3 w-28 rounded-full bg-cyan-300/20 blur-md" />
        </div>
        <div className="mb-3 flex items-center gap-3 text-[11px] text-cyan-100/60" aria-hidden="true"><span>◌ RADAR</span><span>⌁ WIND</span><span>☂ RAIN</span></div>
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-cyan-200">ROOF/OS Weather Desk</p>
        <h2 className="mt-1 text-xl font-semibold text-white">Your virtual meteorologist</h2>
        <p className="mt-1 text-xs text-cyan-100/65">Holographic guide · Setup host</p>
      </div>
      <div className="relative rounded-xl border border-cyan-300/15 bg-cyan-950/35 p-4">
        <p className="text-sm leading-relaxed text-slate-100" aria-live="polite">{message}</p>
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="text-xs text-cyan-100/60">Step {step} of 4</span>
          {speechAvailable && (
            <button type="button" onClick={speak} className="rounded-lg border border-cyan-300/35 px-3 py-2 text-xs font-semibold text-cyan-100 hover:bg-cyan-300/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-200">
              {speaking ? 'Stop voice' : 'Hear guide'}
            </button>
          )}
        </div>
        <p className="mt-2 text-[11px] text-slate-400">Voice is optional and starts only when you press the button. The guide is not displaying a live forecast during setup.</p>
      </div>
    </aside>
  )
}
