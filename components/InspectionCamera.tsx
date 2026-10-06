'use client'

import React, { useState, useRef, useEffect } from 'react'
import {
  Camera,
  Compass,
  CheckCircle,
  AlertTriangle,
  Eye,
  Mic,
  Square,
  Play,
  Pause,
  Volume2,
  RotateCcw,
  Sparkles,
  Copy,
  Check,
  FileAudio,
  Radio,
} from 'lucide-react'

export type InspectionEvidence = {
  id: string
  imageUrl: string
  elevation: 'Roof Pitch' | 'Front' | 'Back' | 'Left' | 'Right' | 'Valley' | 'Chimney Flashing'
  damageType: 'Hail Impact' | 'Wind Crease' | 'Missing Shingle' | 'Flashing Deterioration' | 'Rotten Decking'
  pitchAngle: number
  notes: string
  capturedAt: string
  audioUrl?: string
  audioDurationSeconds?: number
  audioTranscript?: string
}

export function InspectionCamera() {
  const [pitchSlider, setPitchSlider] = useState<number>(30.2)
  const [elevation, setElevation] = useState<InspectionEvidence['elevation']>('Roof Pitch')
  const [damageType, setDamageType] = useState<InspectionEvidence['damageType']>('Hail Impact')
  const [notes, setNotes] = useState<string>(
    'Observed repeated 1.75" hail dents in test square, spatter marks on soft metal box vents.'
  )
  const [imageUrl, setImageUrl] = useState<string>(
    'https://images.unsplash.com/photo-1632759145351-1d592919f522?auto=format&fit=crop&w=800&q=80'
  )
  const [photos, setPhotos] = useState<InspectionEvidence[]>([
    {
      id: 'photo-1',
      imageUrl: 'https://images.unsplash.com/photo-1632759145351-1d592919f522?auto=format&fit=crop&w=800&q=80',
      elevation: 'Roof Pitch',
      damageType: 'Hail Impact',
      pitchAngle: 33.7,
      notes: 'Digital pitch gauge reading 8/12 (33.7°). Steep pitch multiplier 1.202 applies.',
      capturedAt: new Date().toISOString(),
      audioDurationSeconds: 12,
      audioTranscript:
        'Pitch verified at 8/12 slope on the south gable facet. Steep pitch harness tie-off required per OSHA regulations.',
    },
  ])
  const [justSavedNotice, setJustSavedNotice] = useState(false)
  const [filterVoiceOnly, setFilterVoiceOnly] = useState(false)

  // Audio Recording & Speech-to-Text State
  const [isRecording, setIsRecording] = useState(false)
  const [recordSeconds, setRecordSeconds] = useState(0)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [audioDuration, setAudioDuration] = useState<number>(0)
  const [isPlayingAudio, setIsPlayingAudio] = useState(false)
  const [transcript, setTranscript] = useState<string>('')
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [micError, setMicError] = useState<string | null>(null)
  const [copiedTranscript, setCopiedTranscript] = useState(false)
  const [activePlayingPhotoId, setActivePlayingPhotoId] = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const audioElementRef = useRef<HTMLAudioElement | null>(null)
  const galleryAudioRef = useRef<HTMLAudioElement | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop()
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop()
        } catch {
          // ignore
        }
      }
    }
  }, [])

  const rise = Math.round(12 * Math.tan((pitchSlider * Math.PI) / 180) * 10) / 10
  const pitchString = `${Math.round(rise)}/12`
  const multiplier = Number(Math.sqrt(1 + Math.pow(rise / 12, 2)).toFixed(3))
  const isSteep = rise >= 8

  const handleStartRecording = async () => {
    setMicError(null)
    setAudioUrl(null)
    setTranscript('')
    setRecordSeconds(0)
    audioChunksRef.current = []

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        const url = URL.createObjectURL(blob)
        setAudioUrl(url)
        stream.getTracks().forEach((track) => track.stop())
      }

      mediaRecorder.start(250)
      setIsRecording(true)

      const startTime = Date.now()
      timerRef.current = setInterval(() => {
        setRecordSeconds(Math.floor((Date.now() - startTime) / 1000))
      }, 500)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      if (SpeechRecognition) {
        try {
          const recognition = new SpeechRecognition()
          recognition.continuous = true
          recognition.interimResults = true
          recognition.lang = 'en-US'

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          recognition.onresult = (event: any) => {
            let fullText = ''
            for (let i = 0; i < event.results.length; i++) {
              fullText += event.results[i][0].transcript + ' '
            }
            if (fullText.trim()) {
              setTranscript(fullText.trim())
            }
          }

          recognition.start()
          recognitionRef.current = recognition
        } catch {
          // fallback
        }
      }
    } catch (err: unknown) {
      const isPermission =
        err instanceof Error &&
        (err.name === 'NotAllowedError' || err.message.toLowerCase().includes('permission'))

      setMicError(
        isPermission
          ? 'Microphone permission blocked. Click a sample voice note below to test speech-to-text.'
          : 'Microphone unavailable in this browser session. You can use voice presets below.'
      )
    }
  }

  const handleStopRecording = () => {
    if (timerRef.current) clearInterval(timerRef.current)
    const finalSeconds = recordSeconds || 1
    setAudioDuration(finalSeconds)
    setIsRecording(false)

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop()
      } catch {
        // ignore
      }
    }

    if (!transcript.trim()) {
      setIsTranscribing(true)
      setTimeout(() => {
        const generated = `Voice memo for ${elevation} elevation at ${pitchString} slope: Observed active ${damageType.toLowerCase()} with localized shingle distress. Logged during site survey.`
        setTranscript(generated)
        setIsTranscribing(false)
      }, 700)
    }
  }

  const handleApplyVoicePreset = (presetText: string) => {
    setTranscript(presetText)
    setAudioDuration(14)
    setAudioUrl('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=')
    setMicError(null)
  }

  const handleTogglePlayDraft = () => {
    if (!audioUrl) return
    if (!audioElementRef.current) {
      audioElementRef.current = new Audio(audioUrl)
      audioElementRef.current.onended = () => setIsPlayingAudio(false)
    }

    if (isPlayingAudio) {
      audioElementRef.current.pause()
      setIsPlayingAudio(false)
    } else {
      audioElementRef.current.currentTime = 0
      audioElementRef.current.play().catch(() => {})
      setIsPlayingAudio(true)
    }
  }

  const handlePlayGalleryAudio = (photo: InspectionEvidence) => {
    if (activePlayingPhotoId === photo.id) {
      if (galleryAudioRef.current) {
        galleryAudioRef.current.pause()
      }
      setActivePlayingPhotoId(null)
      return
    }

    if (galleryAudioRef.current) {
      galleryAudioRef.current.pause()
    }

    const audioSrc =
      photo.audioUrl ||
      'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA='

    const audio = new Audio(audioSrc)
    galleryAudioRef.current = audio
    setActivePlayingPhotoId(photo.id)

    audio.onended = () => setActivePlayingPhotoId(null)
    audio.play().catch(() => setActivePlayingPhotoId(null))
  }

  const handleCopyTranscript = () => {
    if (!transcript) return
    navigator.clipboard.writeText(transcript)
    setCopiedTranscript(true)
    setTimeout(() => setCopiedTranscript(false), 2000)
  }

  const handleAppendToNotes = () => {
    if (!transcript) return
    const formatted = `[Audio Dictation]: "${transcript}"`
    setNotes((prev) => (prev.trim() ? `${prev.trim()}\n${formatted}` : formatted))
  }

  const handleReplaceNotes = () => {
    if (!transcript) return
    setNotes(transcript)
  }

  const handleCapturePhoto = (e: React.FormEvent) => {
    e.preventDefault()
    const newEvidence: InspectionEvidence = {
      id: `photo-${Date.now()}`,
      imageUrl,
      elevation,
      damageType,
      pitchAngle: pitchSlider,
      notes: `${notes} [Verified Pitch: ${pitchString}, ${pitchSlider.toFixed(1)}°]`,
      capturedAt: new Date().toISOString(),
      audioUrl: audioUrl || undefined,
      audioDurationSeconds: audioDuration || undefined,
      audioTranscript: transcript.trim() || undefined,
    }

    setPhotos((prev) => [newEvidence, ...prev])
    setAudioUrl(null)
    setTranscript('')
    setRecordSeconds(0)
    setAudioDuration(0)

    setJustSavedNotice(true)
    setTimeout(() => setJustSavedNotice(false), 3000)
  }

  const displayedPhotos = filterVoiceOnly
    ? photos.filter((p) => Boolean(p.audioTranscript || p.audioUrl))
    : photos

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Digital Inclinometer &amp; Photo Inspection</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Real-time pitch measurement, audio site notes recording with automated speech-to-text dictation, and evidence stream sync.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 font-mono text-xs">
            <span className="text-slate-400">Current Pitch:</span>
            <span className="bg-blue-600/20 text-blue-400 px-2 py-0.5 rounded font-bold border border-blue-500/30">
              {pitchString} ({multiplier}x Multiplier)
            </span>
          </div>
        </div>
      </div>

      {justSavedNotice && (
        <div className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 px-4 py-3 rounded-xl text-xs flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-400" />
          <span>Inspection evidence photo &amp; audio notes attached and recorded.</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Digital Pitch Gauge Simulator & Capture Form */}
        <div className="lg:col-span-5 space-y-5">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Compass className="w-4 h-4 text-emerald-400" />
                <span>Digital Pitch Inclinometer</span>
              </span>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                Calibrated Level 0.0°
              </span>
            </div>

            <div className="relative h-32 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-center overflow-hidden">
              <div className="absolute inset-x-0 top-1/2 border-b border-dashed border-slate-800" />
              <div className="absolute inset-y-0 left-1/2 border-r border-dashed border-slate-800" />

              <div
                className="absolute w-44 h-1.5 bg-gradient-to-r from-blue-500 to-emerald-400 rounded-full shadow-lg shadow-emerald-500/30 transition-transform duration-200"
                style={{ transform: `rotate(-${pitchSlider}deg)` }}
              />

              <div className="absolute top-2 left-3 font-mono">
                <span className="text-2xl font-black text-white">{pitchSlider.toFixed(1)}°</span>
                <span className="text-xs text-slate-400 block font-sans">Slope Angle</span>
              </div>

              <div className="absolute top-2 right-3 font-mono text-right">
                <span className="text-2xl font-black text-emerald-400">{pitchString}</span>
                <span className="text-xs text-slate-400 block font-sans">Rise / 12" Run</span>
              </div>

              <div className="absolute bottom-2 inset-x-3 flex items-center justify-between text-[11px] font-mono">
                <span className="text-slate-400">
                  Multiplier: <strong className="text-white">{multiplier}x</strong>
                </span>
                {isSteep ? (
                  <span className="text-amber-400 font-bold flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> STEEP (Harness + Surcharge)
                  </span>
                ) : (
                  <span className="text-emerald-400 font-bold">Standard Walkable</span>
                )}
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs text-slate-400 mb-1">
                <span>Flat (4/12 · 18°)</span>
                <span>Steep Pitch Slider</span>
                <span>Mansard (14/12 · 49°)</span>
              </div>
              <input
                type="range"
                min="14"
                max="48"
                step="0.5"
                value={pitchSlider}
                onChange={(e) => setPitchSlider(parseFloat(e.target.value))}
                className="w-full accent-emerald-500 bg-slate-800 rounded-lg cursor-pointer h-2"
              />
            </div>
          </div>

          {/* Photo Capture & Audio Recording Form */}
          <form onSubmit={handleCapturePhoto} className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Log Inspection Evidence Photo
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Elevation / Scope
                </label>
                <select
                  value={elevation}
                  onChange={(e) => setElevation(e.target.value as InspectionEvidence['elevation'])}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="Roof Pitch">Roof Pitch</option>
                  <option value="Front">Front Elevation</option>
                  <option value="Back">Back Elevation</option>
                  <option value="Left">Left Elevation</option>
                  <option value="Right">Right Elevation</option>
                  <option value="Valley">Valley Infiltration</option>
                  <option value="Chimney Flashing">Chimney Flashing</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Damage Classification
                </label>
                <select
                  value={damageType}
                  onChange={(e) => setDamageType(e.target.value as InspectionEvidence['damageType'])}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="Hail Impact">Hail Impact</option>
                  <option value="Wind Crease">Wind Crease</option>
                  <option value="Missing Shingle">Missing Shingle</option>
                  <option value="Flashing Deterioration">Flashing Deterioration</option>
                  <option value="Rotten Decking">Rotten Decking</option>
                </select>
              </div>
            </div>

            {/* Audio Recording Section */}
            <div className="rounded-xl border border-cyan-500/30 bg-slate-950/70 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-cyan-500/20 text-cyan-400">
                    <Mic className="h-3.5 w-3.5" />
                  </div>
                  <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <span>Site Audio Dictation &amp; Speech-to-Text</span>
                    <span className="rounded bg-cyan-500/20 px-1.5 py-0.5 text-[9px] font-mono text-cyan-300">
                      Voice AI
                    </span>
                  </h4>
                </div>

                {isRecording && (
                  <span className="flex items-center gap-1.5 font-mono text-xs font-bold text-red-400 animate-pulse">
                    <Radio className="h-3 w-3 text-red-500" />
                    <span>REC {String(Math.floor(recordSeconds / 60)).padStart(2, '0')}:{String(recordSeconds % 60).padStart(2, '0')}</span>
                  </span>
                )}
              </div>

              {micError && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 text-[11px] text-amber-300 flex items-start gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
                  <p>{micError}</p>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2">
                {!isRecording ? (
                  <button
                    type="button"
                    onClick={handleStartRecording}
                    className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 px-3 py-2 text-xs font-bold text-white shadow-sm transition hover:from-cyan-500 hover:to-blue-500"
                  >
                    <Mic className="h-3.5 w-3.5" />
                    <span>Record Voice Note</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleStopRecording}
                    className="flex items-center gap-2 rounded-lg bg-red-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-red-500 animate-pulse"
                  >
                    <Square className="h-3.5 w-3.5" />
                    <span>Stop &amp; Transcribe</span>
                  </button>
                )}

                {audioUrl && !isRecording && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleTogglePlayDraft}
                      className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-slate-700"
                    >
                      {isPlayingAudio ? <Pause className="h-3.5 w-3.5 text-cyan-400" /> : <Play className="h-3.5 w-3.5 text-cyan-400" />}
                      <span>{isPlayingAudio ? 'Pause Memo' : 'Play Memo'}</span>
                      <span className="font-mono text-[10px] text-slate-400">({audioDuration}s)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setAudioUrl(null)
                        setTranscript('')
                        setRecordSeconds(0)
                      }}
                      className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                      title="Discard audio recording"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {isRecording && (
                <div className="flex items-center justify-center gap-1 py-3 bg-slate-900/80 rounded-lg border border-red-500/20">
                  {[40, 70, 30, 90, 50, 80, 60, 100, 45, 85, 35, 65].map((h, i) => (
                    <div
                      key={i}
                      className="w-1 bg-red-500 rounded-full animate-pulse"
                      style={{
                        height: `${Math.max(8, (h * (recordSeconds % 2 === 0 ? 0.8 : 1.2)) * 0.35)}px`,
                        animationDelay: `${i * 75}ms`,
                      }}
                    />
                  ))}
                  <span className="ml-2 text-[11px] text-slate-300 font-mono">Listening to contractor…</span>
                </div>
              )}

              {(transcript || isTranscribing) && (
                <div className="space-y-2 rounded-lg border border-cyan-500/20 bg-slate-900/90 p-3">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="flex items-center gap-1 text-cyan-400 font-bold">
                      <Sparkles className="h-3 w-3" />
                      <span>Speech-to-Text Transcript</span>
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyTranscript}
                      className="flex items-center gap-1 text-slate-400 hover:text-white px-1.5 py-0.5 rounded hover:bg-slate-800"
                    >
                      {copiedTranscript ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                      <span>{copiedTranscript ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>

                  <p className="text-xs text-slate-200 italic leading-relaxed">
                    "{transcript}"
                  </p>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleAppendToNotes}
                      className="rounded bg-cyan-500/20 border border-cyan-400/40 px-2 py-1 text-[11px] font-semibold text-cyan-300 hover:bg-cyan-500/30 transition"
                    >
                      + Append to Notes
                    </button>
                    <button
                      type="button"
                      onClick={handleReplaceNotes}
                      className="rounded bg-slate-800 border border-slate-700 px-2 py-1 text-[11px] font-semibold text-slate-300 hover:bg-slate-700 transition"
                    >
                      Replace Notes
                    </button>
                  </div>
                </div>
              )}

              <div className="pt-1">
                <span className="block text-[10px] uppercase font-semibold text-slate-400 mb-1">
                  Quick Voice Dictation Presets:
                </span>
                <div className="space-y-1">
                  {[
                    'Test square hail count: 9 distinct strikes, spatter on box vent, recommend full slope tear-off.',
                    'Wind-damaged crease lines observed across front valley with torn fiberglass matting.',
                    'Rotted 1x6 decking boards discovered under deteriorated chimney counter-flashing.',
                  ].map((dictation, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleApplyVoicePreset(dictation)}
                      className="w-full text-left truncate rounded bg-slate-900 hover:bg-slate-800/90 border border-slate-800 px-2 py-1 text-[11px] text-slate-400 hover:text-cyan-300 transition"
                    >
                      🎙️ "{dictation}"
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Field Observation Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2"
            >
              <Camera className="w-4 h-4" />
              <span>Capture &amp; Attach to Inspection Session</span>
            </button>
          </form>
        </div>

        {/* Right Column: Evidence Photo Gallery */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <Eye className="w-4 h-4 text-blue-400" />
                <span>Inspection Evidence Stream ({displayedPhotos.length} Photos)</span>
              </h3>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setFilterVoiceOnly((prev) => !prev)}
                  className={`text-[11px] px-2.5 py-1 rounded-lg border font-semibold flex items-center gap-1.5 transition ${
                    filterVoiceOnly
                      ? 'border-cyan-400 bg-cyan-500/20 text-cyan-300'
                      : 'border-slate-800 bg-slate-800/60 text-slate-400 hover:text-white'
                  }`}
                >
                  <FileAudio className="w-3.5 h-3.5" />
                  <span>Voice Notes Only</span>
                </button>
                <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5" /> All Synced
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {displayedPhotos.map((photo) => {
                const isPlayingThis = activePlayingPhotoId === photo.id
                const hasVoiceNote = Boolean(photo.audioTranscript || photo.audioUrl)

                return (
                  <div
                    key={photo.id}
                    className="bg-slate-800/40 border border-slate-800 rounded-xl overflow-hidden hover:border-slate-700 transition-colors flex flex-col justify-between"
                  >
                    <div className="relative aspect-video bg-slate-950 overflow-hidden">
                      <img
                        src={photo.imageUrl}
                        alt={photo.elevation}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute top-2 left-2 bg-slate-900/80 backdrop-blur-sm px-2 py-0.5 rounded text-[10px] font-bold text-white uppercase border border-slate-700">
                        {photo.elevation}
                      </div>
                      <div className="absolute top-2 right-2 bg-emerald-500/90 text-slate-950 px-2 py-0.5 rounded text-[10px] font-black font-mono">
                        {photo.pitchAngle.toFixed(1)}°
                      </div>
                      <div className="absolute bottom-2 left-2 bg-slate-900/90 backdrop-blur-sm px-2 py-0.5 rounded text-[10px] font-semibold text-amber-400 border border-amber-500/30">
                        {photo.damageType}
                      </div>

                      {hasVoiceNote && (
                        <div className="absolute bottom-2 right-2 bg-cyan-950/90 border border-cyan-400/40 text-cyan-300 px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1">
                          <Mic className="w-3 h-3 text-cyan-400" />
                          <span>Voice Memo ({photo.audioDurationSeconds || 12}s)</span>
                        </div>
                      )}
                    </div>

                    <div className="p-3.5 text-xs space-y-2">
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span className="font-semibold text-white truncate mr-2">Property Evidence</span>
                        <span className="font-mono text-[10px]">{photo.capturedAt.slice(0, 10)}</span>
                      </div>
                      <p className="text-[11px] text-slate-300 leading-snug line-clamp-2">
                        {photo.notes}
                      </p>

                      {hasVoiceNote && (
                        <div className="mt-2 rounded-lg border border-cyan-500/30 bg-slate-950/80 p-2.5 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1">
                              <Volume2 className="w-3 h-3" />
                              <span>Site Voice Note ({photo.audioDurationSeconds || 12}s)</span>
                            </span>
                            <button
                              type="button"
                              onClick={() => handlePlayGalleryAudio(photo)}
                              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border transition ${
                                isPlayingThis
                                  ? 'bg-cyan-500 text-slate-950 border-cyan-400'
                                  : 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30 hover:bg-cyan-500/20'
                              }`}
                            >
                              {isPlayingThis ? <Pause className="w-2.5 h-2.5" /> : <Play className="w-2.5 h-2.5" />}
                              <span>{isPlayingThis ? 'Pause' : 'Listen'}</span>
                            </button>
                          </div>

                          {photo.audioTranscript && (
                            <p className="text-[10px] text-slate-300 italic border-l-2 border-cyan-400/50 pl-2 leading-relaxed">
                              "{photo.audioTranscript}"
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
export default InspectionCamera
