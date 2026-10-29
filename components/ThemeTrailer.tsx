'use client'
import { useEffect, useRef } from 'react'
export default function ThemeTrailer({ onClose, muted = false }: { onClose: () => void; muted?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const video = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    const node = dialog.current
    const media = video.current
    const previous = document.activeElement as HTMLElement | null
    node?.showModal()
    // Native controls remain available if the browser requires a second playback gesture.
    void media?.play().catch(() => {})
    const hidden = () => { if (document.hidden) media?.pause() }
    document.addEventListener('visibilitychange', hidden)
    return () => { document.removeEventListener('visibilitychange', hidden); media?.pause(); node?.close(); if (previous?.isConnected) previous.focus() }
  }, [])
  return <dialog ref={dialog} className="theme-trailer" aria-label="ROOF/OS Storm Command trailer" onCancel={onClose} onClose={onClose}>
    <button type="button" className="theme-trailer-close" onClick={onClose} autoFocus>Close trailer ×</button>
    <video ref={video} controls playsInline muted={muted} preload="metadata" poster="/themes/storm-command.webp" src="/themes/roofos-storm-trailer.mp4" aria-label="36-second ROOF/OS cinematic trailer with storm sound">
      Your browser cannot play this video. <a href="/themes/roofos-storm-trailer.mp4">Download the trailer.</a>
    </video>
  </dialog>
}
