'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function VoiceAI() {
  const router = useRouter()
  const [isListening, setIsListening] = useState(false)
  const [command, setCommand] = useState('')
  const [response, setResponse] = useState('')
  const [history, setHistory] = useState<{ command: string; response: string; time: string }[]>([])

  const startVoiceRecognition = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setResponse('This browser cannot record audio. Local Whisper was not called.')
      return
    }
    setIsListening(true)
    setResponse('Recording. Local Whisper transcribes when you stop.')
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const recorder = new MediaRecorder(stream)
    const chunks: Blob[] = []
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data)
    }
    recorder.onstop = () => {
      stream.getTracks().forEach((track) => track.stop())
      void sendToWhisper(new Blob(chunks, { type: recorder.mimeType || 'audio/webm' }))
    }
    recorder.start()
    window.setTimeout(() => {
      if (recorder.state !== 'inactive') recorder.stop()
    }, 8000)
  }

  const sendToWhisper = async (audio: Blob) => {
    setResponse('Sending audio to the local Whisper worker.')
    try {
      const body = new FormData()
      body.append('file', audio, 'command.webm')
      body.append('language', 'en')
      const transcribed = await fetch('/api/ai/transcribe', { method: 'POST', body })
      const payload = await transcribed.json() as { text?: string; error?: string }
      if (!transcribed.ok || !payload.text) {
        setResponse(payload.error || 'Local Whisper returned no transcript.')
        return
      }
      await processVoiceCommand(payload.text)
    } catch {
      setResponse('Could not reach the local Whisper route.')
    } finally {
      setIsListening(false)
    }
  }

  const processVoiceCommand = async (text: string) => {
    setCommand(text)
    setResponse('Routing the transcript through local Ollama.')
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: text }),
      })
      const data = await res.json()
      const reply = data.reply || (res.ok ? 'Command processed.' : 'Could not route the command.')
      setResponse(reply)
      setHistory((prev) => [{ command: text, response: reply, time: new Date().toLocaleTimeString() }, ...prev])
      if (data.action?.type === 'navigate' && data.action.url) router.push(data.action.url)
    } catch {
      setResponse('Network error routing the command.')
    }
  }

  return (
    <div className="space-y-4 pb-4">
      <header className="glass sticky top-0 z-10 rounded-xl mb-4">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center">
            <button onClick={() => router.back()} className="mr-3 text-xl text-cyan-300">←</button>
            <h1 className="text-xl font-bold">Local Whisper voice</h1>
          </div>
          <span className="bg-emerald-500 text-black text-xs font-bold px-2 py-0.5 rounded">FASTER-WHISPER</span>
        </div>
      </header>
      <main className="p-4 space-y-4">
        <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg shadow-lg p-6 text-center border border-cyan-400/30">
          <div className={`text-6xl mb-3 ${isListening ? 'animate-pulse text-red-500' : ''}`}>{isListening ? '🎙' : '🤖'}</div>
          <p className="font-bold text-white">Speak a command</p>
          <p className="text-xs text-slate-300 mt-1">Records up to 8 seconds, then local Whisper and local Ollama.</p>
        </div>
        <button onClick={() => void startVoiceRecognition()} disabled={isListening} className={`w-full py-4 rounded-lg font-bold text-lg shadow ${isListening ? 'bg-red-600 text-white' : 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white'}`}>
          {isListening ? 'Recording for local Whisper…' : 'Start voice command'}
        </button>
        {command && <div className="glass rounded-xl p-4 border-l-4 border-blue-600"><p className="text-xs text-slate-400 font-bold uppercase">Transcript</p><p className="font-bold text-white mt-0.5">"{command}"</p></div>}
        {response && <div className="glass rounded-xl p-4 border-l-4 border-emerald-500"><p className="text-xs text-slate-400 font-bold uppercase">Response</p><p className="text-slate-100 text-sm mt-0.5">{response}</p></div>}
        {history.length > 0 && (
          <div className="glass rounded-xl p-4">
            <h3 className="font-bold text-sm text-slate-100 mb-3">{history.length} commands</h3>
            <div className="space-y-2">
              {history.map((item, i) => (
                <div key={i} className="border-b last:border-0 pb-2 text-xs">
                  <div className="flex justify-between"><p className="font-bold text-white">{item.command}</p><p className="text-slate-400">{item.time}</p></div>
                  <p className="text-slate-300 mt-0.5">{item.response}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
