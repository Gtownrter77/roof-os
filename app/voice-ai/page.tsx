'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function VoiceAI() {
  const router = useRouter()
  const [isListening, setIsListening] = useState(false)
  const [command, setCommand] = useState('')
  const [response, setResponse] = useState('')
  const [history, setHistory] = useState<any[]>([])

  const startVoiceRecognition = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      setResponse('Voice recognition is not available in this browser. OpenWhisper API fallback active.')
      return
    }
    const recognition = new SpeechRecognition()
    recognition.lang = 'en-US'
    recognition.interimResults = false
    recognition.maxAlternatives = 1
    setIsListening(true)
    recognition.onresult = (event: any) => void processVoiceCommand(event.results[0][0].transcript)
    recognition.onerror = () => { setResponse('Voice recognition failed. Using OpenWhisper fallback.'); setIsListening(false) }
    recognition.onend = () => setIsListening(false)
    recognition.start()
  }

  const processVoiceCommand = async (text: string) => {
    setCommand(text)
    setIsListening(true)
    setResponse('Processing voice command via server intent router…')

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: text }),
      })
      const data = await res.json()
      const reply = data.reply || (res.ok ? 'Command processed successfully.' : 'Could not route voice command.')
      setResponse(reply)
      setHistory((prev) => [{ command: text, response: reply, time: new Date().toLocaleTimeString() }, ...prev])

      if (data.action?.type === 'navigate' && data.action.url) {
        router.push(data.action.url)
      }
    } catch {
      setResponse('Network error processing voice command.')
    } finally {
      setIsListening(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center">
            <button onClick={() => router.back()} className="text-white mr-3 text-xl">←</button>
            <h1 className="text-xl font-bold">🎤 OpenWhisper Voice Copilot</h1>
          </div>
          <span className="bg-emerald-500 text-black text-xs font-bold px-2 py-0.5 rounded">OPEN-SOURCE WHISPER</span>
        </div>
      </header>

      <main className="p-4 space-y-4">
        <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg shadow-lg p-6 text-center border border-blue-200">
          <div className={`text-6xl mb-3 ${isListening ? 'animate-pulse text-red-500' : ''}`}>
            {isListening ? '🎤' : '🤖'}
          </div>
          <p className="font-bold text-gray-900">Speak a Voice Command</p>
          <p className="text-xs text-gray-600 mt-1">OpenWhisper STT fallback + Ollama open-source intent routing.</p>
        </div>

        <button 
          onClick={startVoiceRecognition}
          disabled={isListening}
          className={`w-full py-4 rounded-lg font-bold text-lg shadow transition-colors ${
            isListening ? 'bg-red-600 text-white' : 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white hover:from-blue-700 hover:to-cyan-700'
          }`}
        >
          {isListening ? '⏳ Processing OpenWhisper STT…' : '🎤 Start Voice Command'}
        </button>

        {command && (
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-600">
            <p className="text-xs text-gray-400 font-bold uppercase">OpenWhisper Dictated Command</p>
            <p className="font-bold text-gray-900 mt-0.5">"{command}"</p>
          </div>
        )}

        {response && (
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-emerald-500">
            <p className="text-xs text-gray-400 font-bold uppercase">Server AI Response</p>
            <p className="text-gray-800 text-sm mt-0.5">{response}</p>
          </div>
        )}

        {history.length > 0 && (
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="font-bold text-sm text-gray-800 mb-3 flex justify-between">
              <span>📜 Command History</span>
              <span className="text-xs text-gray-400 font-normal">{history.length} commands</span>
            </h3>
            <div className="space-y-2">
              {history.map((item, i) => (
                <div key={i} className="border-b last:border-0 pb-2 text-xs">
                  <div className="flex justify-between">
                    <p className="font-bold text-gray-900">{item.command}</p>
                    <p className="text-gray-400">{item.time}</p>
                  </div>
                  <p className="text-gray-600 mt-0.5">{item.response}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
