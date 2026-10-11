'use client'

import { useEffect, useState } from 'react'

const SEEN_KEY = 'roofos.trailer.seen.v1'

const BEATS = [
  { kicker: 'THE SKY JUST TURNED', line: 'You are already in it.' },
  { kicker: 'THE ROOF', line: 'See it. Walk it. Keep the proof.' },
  { kicker: 'ROOF/OS', line: 'Storm command. On the ground.' },
]

export default function EntranceTrailer() {
  const [open, setOpen] = useState(false)
  const [beat, setBeat] = useState(-1)
  const [lit, setLit] = useState(false)

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const force = new URLSearchParams(window.location.search).get('trailer') === '1'
    const seen = window.localStorage.getItem(SEEN_KEY) === '1'
    const start = () => {
      setBeat(reduced ? BEATS.length - 1 : -1)
      setLit(!reduced)
      setOpen(true)
    }
    if (force || !seen) start()
    const onPlay = () => start()
    window.addEventListener('roofos-play-trailer', onPlay)
    return () => window.removeEventListener('roofos-play-trailer', onPlay)
  }, [])

  useEffect(() => {
    if (!open || beat >= BEATS.length - 1) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) return
    const delay = beat < 0 ? 1400 : 3400
    const timer = window.setTimeout(() => {
      setLit(true)
      setBeat((current) => current + 1)
    }, delay)
    return () => window.clearTimeout(timer)
  }, [open, beat])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  function close() {
    window.localStorage.setItem(SEEN_KEY, '1')
    setOpen(false)
  }

  if (!open) return null
  const card = beat >= 0 ? BEATS[beat] : null

  return (
    <div className="trailer-root" role="dialog" aria-modal="true" aria-label="ROOF/OS entrance">
      <div className={`trailer-plate ${lit ? 'is-lit' : ''}`} />
      <div className="trailer-rain" aria-hidden="true" />
      <div className="trailer-shade" />
      <div className="trailer-ring" aria-hidden="true" />
      <div className="trailer-flash" aria-hidden="true" />
      <div className="trailer-copy">
        {card ? (
          <>
            <p className={`trailer-kicker ${card.kicker === 'ROOF/OS' ? 'is-mark' : ''}`}>{card.kicker}</p>
            <p className="trailer-line">{card.line}</p>
          </>
        ) : (
          <p className="trailer-kicker">ROOF/OS</p>
        )}
        {beat >= BEATS.length - 1 ? (
          <button type="button" className="trailer-enter" onClick={close}>Enter</button>
        ) : null}
      </div>
      <button type="button" className="trailer-skip" onClick={close}>Skip</button>
    </div>
  )
}
