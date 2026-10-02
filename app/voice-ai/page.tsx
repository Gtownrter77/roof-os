'use client'

import { useState } from 'react'

export default function VoiceAI() {
  const [isListening, setIsListening] = useState(false)
  const [command, setCommand] = useState('')
  const [message, setMessage] = useState('')

  const startVoiceRecognition = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      setMessage('Voice recognition is not available in this browser.')
      return
    }
    const recognition = new SpeechRecognition()
    recognition.lang = 'en-US'
    recognition.interimResults = false
    recognition.maxAlternatives = 1
    setIsListening(true)
    recognition.onresult = (event: any) => {
      const text = event.results[0][0].transcript
      setCommand(text)
      setMessage('Voice command captured. Command execution is not connected.')
    }
    recognition.onerror = () => {
      setMessage('Voice recognition failed. Please try again.')
      setIsListening(false)
    }
    recognition.onend = () => setIsListening(false)
    recognition.start()
  }

  return (
    <main className="min-h-screen bg-gray-50 p-4">
      <h1 className="text-2xl font-bold mb-4">AI Voice Command</h1>
      <section className="bg-white rounded-lg shadow p-6">
        <p className="text-sm text-gray-600">
          Browser speech recognition can capture a command, but no fabricated responses or simulated workflow execution are used.
        </p>
        <button onClick={startVoiceRecognition} disabled={isListening} className="mt-4 bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50">
          {isListening ? 'Listening…' : 'Start Voice Command'}
        </button>
        {command && <p className="mt-4 text-sm">Captured: {command}</p>}
        {message && <p className="mt-2 text-sm text-gray-600">{message}</p>}
      </section>
    </main>
  )
}
