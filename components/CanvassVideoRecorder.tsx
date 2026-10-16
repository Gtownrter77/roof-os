'use client'

import { useEffect, useRef, useState } from 'react'

export type CanvassRecordingStatus = 'not_recorded' | 'recording' | 'ready' | 'consent_not_obtained' | 'consented_not_recorded'

type Props = {
  onRecordingChange: (recording: Blob | null, consentedAt: string | null, status: CanvassRecordingStatus) => void
}

export default function CanvassVideoRecorder({ onRecordingChange }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<BlobPart[]>([])
  const previewUrlRef = useRef<string | null>(null)
  const [consentConfirmed, setConsentConfirmed] = useState(false)
  const [recording, setRecording] = useState(false)
  const [message, setMessage] = useState('Recording is off. Get explicit permission before starting the camera.')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [consentedAt, setConsentedAt] = useState<string | null>(null)

  useEffect(() => () => {
    recorderRef.current?.state !== 'inactive' && recorderRef.current?.stop()
    streamRef.current?.getTracks().forEach((track) => track.stop())
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
  }, [])

  async function startRecording() {
    if (!consentConfirmed) {
      setMessage('Recording blocked. Confirm that the person being recorded gave explicit permission.')
      return
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setMessage('This browser does not support video recording. Save the lead without video and record the reason.')
      onRecordingChange(null, null, 'consented_not_recorded')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play().catch(() => undefined)
      }
      const mimeType = ['video/webm;codecs=vp8', 'video/webm'].find((type) => MediaRecorder.isTypeSupported(type))
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
      chunksRef.current = []
      const consentTime = new Date().toISOString()
      setConsentedAt(consentTime)
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'video/webm' })
        stream.getTracks().forEach((track) => track.stop())
        streamRef.current = null
        if (videoRef.current) videoRef.current.srcObject = null
        if (blob.size > 0) {
          if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
          const url = URL.createObjectURL(blob)
          previewUrlRef.current = url
          setPreviewUrl(url)
          onRecordingChange(blob, consentTime, 'ready')
          setMessage('Recording ready. Review it before saving the lead; the video will be stored privately with the lead.')
        } else {
          onRecordingChange(null, consentTime, 'consented_not_recorded')
          setMessage('No video data was captured. The lead can still be saved with a no-video status.')
        }
        setRecording(false)
      }
      recorderRef.current = recorder
      recorder.start(1000)
      setRecording(true)
      setMessage('RECORDING — video only, no audio. The camera preview is visible below. Stop recording before saving the lead.')
    } catch {
      setMessage('Camera access failed or was denied. No recording was made; you may still save the lead without video.')
      onRecordingChange(null, null, 'consented_not_recorded')
    }
  }

  function stopRecording() {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop()
  }

  function clearRecording() {
    if (recording) stopRecording()
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
    previewUrlRef.current = null
    setPreviewUrl(null)
    setConsentedAt(null)
    setConsentConfirmed(false)
    onRecordingChange(null, null, 'not_recorded')
    setMessage('Recording cleared. Get explicit permission before starting a new recording.')
  }

  return (
    <section className="rounded-lg border border-amber-400/50 bg-amber-400/5 p-3 space-y-2" aria-label="Optional consent-based canvass video recording">
      <div>
        <h3 className="font-bold text-sm text-slate-100">Lead video evidence</h3>
        <p className="text-xs text-slate-300">Video only; audio is disabled. Never record secretly. Ask first, explain the purpose, and respect a refusal. A lead can be saved without recording.</p>
      </div>
      <label className="flex gap-2 items-start text-xs text-slate-200">
        <input
          type="checkbox"
          checked={consentConfirmed}
          disabled={recording}
          onChange={(event) => setConsentConfirmed(event.target.checked)}
          className="mt-0.5"
        />
        <span>I confirmed the person being recorded gave explicit permission for this video, and they can see the camera is active.</span>
      </label>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => void startRecording()} disabled={recording || !consentConfirmed} className="rounded bg-red-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-40">
          {recording ? 'Recording…' : 'Start video'}
        </button>
        <button type="button" onClick={stopRecording} disabled={!recording} className="rounded border border-slate-400 px-3 py-2 text-xs font-bold text-slate-100 disabled:opacity-40">
          Stop & save clip
        </button>
      </div>
      {recording && <video ref={videoRef} autoPlay muted playsInline className="w-full max-h-64 rounded bg-black" aria-label="Live camera preview" />}
      {previewUrl && !recording && <video src={previewUrl} controls playsInline className="w-full max-h-64 rounded bg-black" aria-label="Recorded lead video preview" />}
      <p role="status" aria-live="polite" className="text-xs text-slate-200">{message}</p>
      {(previewUrl || consentedAt) && <button type="button" onClick={clearRecording} className="text-xs underline text-slate-300">Discard video and consent state</button>}
    </section>
  )
}
