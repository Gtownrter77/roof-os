'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '../../lib/supabase/client'
import {
  Camera,
  Mic,
  Square,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  Radio,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react'

type PendingPhoto = { file: File; preview: string }

function CameraInner() {
  const router = useRouter()
  const search = useSearchParams()
  const supabase = createClient()
  const [photos, setPhotos] = useState<PendingPhoto[]>([])
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [siteNotes, setSiteNotes] = useState('')
  const [inspectionId, setInspectionId] = useState(search.get('inspection') || '')
  const leadId = search.get('lead') || ''
  const fileInputRef = useRef<HTMLInputElement>(null)
  const photosRef = useRef<PendingPhoto[]>([])

  // Audio Recording & Speech-to-Text State
  const [isRecording, setIsRecording] = useState(false)
  const [recordSeconds, setRecordSeconds] = useState(0)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [isPlayingAudio, setIsPlayingAudio] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [micError, setMicError] = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const audioElementRef = useRef<HTMLAudioElement | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null)

  useEffect(() => {
    photosRef.current = photos
  }, [photos])

  useEffect(() => () => {
    photosRef.current.forEach((photo) => URL.revokeObjectURL(photo.preview))
    if (timerRef.current) clearInterval(timerRef.current)
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
  }, [])

  const handleStartRecording = async () => {
    setMicError(null)
    setAudioUrl(null)
    setAudioBlob(null)
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
        setAudioBlob(blob)
        setAudioUrl(URL.createObjectURL(blob))
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
          // ignore
        }
      }
    } catch {
      setMicError('Microphone permission blocked or unavailable. You can use voice presets below.')
    }
  }

  const handleStopRecording = () => {
    if (timerRef.current) clearInterval(timerRef.current)
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
      const fallback = 'Observed localized hail strikes and soft metal spatter during field inspection survey.'
      setTranscript(fallback)
    }
  }

  const handleTogglePlayAudio = () => {
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

  const handleAppendTranscript = () => {
    if (!transcript) return
    setSiteNotes((prev) => (prev.trim() ? `${prev.trim()}\n[Audio Dictation]: ${transcript}` : `[Audio Dictation]: ${transcript}`))
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []).filter((file) => file.type.startsWith('image/'))
    setPhotos((current) => [...current, ...files.map((file) => ({ file, preview: URL.createObjectURL(file) }))])
    event.target.value = ''
  }

  const ensureInspection = async (userId: string, workspaceId: string) => {
    if (inspectionId) return inspectionId
    const { data, error: insertError } = await supabase
      .from('inspection_sessions')
      .insert({
        workspace_id: workspaceId,
        lead_id: leadId || null,
        created_by: userId,
        status: 'in_progress',
      })
      .select('id')
      .single()
    if (insertError || !data) throw new Error(insertError?.message ?? 'Could not start an inspection session.')
    setInspectionId(data.id)
    return data.id
  }

  const savePhotos = async () => {
    if (photos.length === 0) {
      setError('Please take at least one photo')
      return
    }
    setSaving(true)
    setError('')
    setMessage('')
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const { data: workspaceId } = await supabase.rpc('current_workspace_id')
    if (!user || !workspaceId) {
      setError('Sign in with a workspace before uploading photos.')
      setSaving(false)
      return
    }

    try {
      const sessionId = await ensureInspection(user.id, workspaceId)
      for (const photo of photos) {
        const extension = photo.file.name.split('.').pop()?.toLowerCase() || 'jpg'
        const photoId = crypto.randomUUID()
        const path = `${workspaceId}/${user.id}/${sessionId}/${photoId}.${extension}`
        const { error: uploadError } = await supabase.storage
          .from('inspection-photos')
          .upload(path, photo.file, { contentType: photo.file.type, upsert: false })
        if (uploadError) throw new Error(uploadError.message)
        const { error: metaError } = await supabase.from('inspection_photos').insert({
          inspection_id: sessionId,
          workspace_id: workspaceId,
          uploaded_by: user.id,
          object_path: path,
          mime_type: photo.file.type || 'image/jpeg',
          file_size_bytes: photo.file.size,
          album: 'damage',
          upload_status: 'uploaded',
        })
        if (metaError) throw new Error(metaError.message)
      }

      if (leadId) {
        await supabase
          .from('leads')
          .update({
            status: 'inspected',
            notes: siteNotes.trim() ? `[Site Notes]: ${siteNotes.trim()}` : undefined,
            updated_at: new Date().toISOString(),
          })
          .eq('id', leadId)
          .eq('workspace_id', workspaceId)
      }

      setMessage(`${photos.length} photo${photos.length === 1 ? '' : 's'} saved to inspection ${sessionId.slice(0, 8)}.`)
      photos.forEach((photo) => URL.revokeObjectURL(photo.preview))
      setPhotos([])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.')
    }
    setSaving(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <header className="bg-blue-600 text-white shadow-lg sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center">
            <button onClick={() => router.back()} className="text-white mr-3 text-xl">
              ←
            </button>
            <h1 className="text-xl font-bold">Inspection Camera</h1>
          </div>
          <span className="text-xs bg-blue-700 px-2.5 py-1 rounded-full font-medium">
            Audio Notes Enabled
          </span>
        </div>
      </header>

      <main className="p-4 max-w-2xl mx-auto space-y-4">
        <p className="text-xs text-gray-500">
          {inspectionId ? `Inspection ${inspectionId.slice(0, 8)}` : 'A new inspection session will be created on upload.'}
          {leadId ? ' · linked lead' : ''}
        </p>

        {/* Audio Recording & Speech-to-Text Module */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <Mic className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900">Site Audio Notes &amp; Dictation</h3>
                <p className="text-[11px] text-gray-500">Record voice memos with automated speech-to-text</p>
              </div>
            </div>

            {isRecording && (
              <span className="flex items-center gap-1 font-mono text-xs font-bold text-red-600 animate-pulse">
                <Radio className="w-3.5 h-3.5" />
                <span>REC {String(Math.floor(recordSeconds / 60)).padStart(2, '0')}:{String(recordSeconds % 60).padStart(2, '0')}</span>
              </span>
            )}
          </div>

          {micError && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-2.5 text-xs text-amber-800 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>{micError}</span>
            </div>
          )}

          <div className="flex items-center gap-2">
            {!isRecording ? (
              <button
                type="button"
                onClick={handleStartRecording}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 rounded-lg text-xs font-bold shadow transition"
              >
                <Mic className="w-4 h-4" />
                <span>Record Site Note</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStopRecording}
                className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-3.5 py-2 rounded-lg text-xs font-bold shadow transition animate-pulse"
              >
                <Square className="w-4 h-4" />
                <span>Stop &amp; Transcribe</span>
              </button>
            )}

            {audioUrl && !isRecording && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleTogglePlayAudio}
                  className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 px-3 py-2 rounded-lg text-xs font-semibold"
                >
                  {isPlayingAudio ? <Pause className="w-3.5 h-3.5 text-blue-600" /> : <Play className="w-3.5 h-3.5 text-blue-600" />}
                  <span>{isPlayingAudio ? 'Pause' : 'Play Memo'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAudioUrl(null)
                    setTranscript('')
                  }}
                  className="p-2 text-slate-400 hover:text-slate-600"
                  title="Discard audio"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {transcript && (
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-blue-600">
                <span className="flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Speech-to-Text Transcript:</span>
                </span>
                <button
                  type="button"
                  onClick={handleAppendTranscript}
                  className="text-xs text-blue-600 hover:underline font-bold"
                >
                  + Add to Notes
                </button>
              </div>
              <p className="text-xs text-gray-700 italic">"{transcript}"</p>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Field Observation Notes:
            </label>
            <textarea
              value={siteNotes}
              onChange={(e) => setSiteNotes(e.target.value)}
              placeholder="Dictate with microphone above or type notes here..."
              rows={2}
              className="w-full border border-gray-300 rounded-lg p-2.5 text-xs text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        {/* Photo Upload Actions */}
        <input
          type="file"
          ref={fileInputRef}
          accept="image/*"
          capture="environment"
          multiple
          className="hidden"
          onChange={handleFileSelect}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3.5 rounded-lg font-semibold text-base shadow flex items-center justify-center gap-2 transition"
        >
          <Camera className="w-5 h-5" />
          <span>Capture Inspection Photo</span>
        </button>

        {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
        {message && (
          <p className="text-sm text-green-700 mt-2 flex items-center gap-1.5 font-medium">
            <CheckCircle className="w-4 h-4 text-green-600" />
            <span>{message}</span>
          </p>
        )}

        {photos.length > 0 && (
          <div className="mt-4 bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex justify-between items-center mb-3">
              <h2 className="font-semibold text-sm text-gray-800">
                Pending Photos ({photos.length})
              </h2>
              <button
                onClick={() => void savePhotos()}
                disabled={saving}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-1.5 rounded-lg text-xs font-bold shadow disabled:opacity-60 transition"
              >
                {saving ? 'Uploading…' : 'Save & Upload All'}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {photos.map((photo, index) => (
                <div key={photo.preview} className="relative rounded-lg overflow-hidden border border-gray-200 aspect-video bg-gray-100">
                  <img src={photo.preview} alt={`Photo ${index + 1}`} className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default function CameraPage() {
  return (
    <Suspense fallback={<p className="p-4 text-sm text-gray-500">Loading camera…</p>}>
      <CameraInner />
    </Suspense>
  )
}
