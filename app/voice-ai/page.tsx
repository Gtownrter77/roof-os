'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type HistoryItem = {
  command: string
  response: string
  time: string
}

export default function VoiceAI() {
  const router = useRouter()
  const [isListening, setIsListening] = useState(false)
  const [command, setCommand] = useState('')
  const [response, setResponse] = useState('')
  const [history, setHistory] = useState<HistoryItem[]>([])

  const voiceCommands = [
    'Show me all leads',
    'Open the inspection workflow',
    'Open the schedule',
    'Open the photo estimate',
  ]

  const startVoiceRecognition = () => {
    const SpeechRecognition = (window as typeof window & {
      SpeechRecognition?: new () => {
        lang: string
        interimResults: boolean
        maxAlternatives: number
        onresult: ((event: { results: Array<Array<{ transcript: string }>> }) => void) | null
        onerror: (() => void) | null
        onend: (() => void) | null
        start: () => void
      }
      webkitSpeechRecognition?: new () => {
        lang: string
        interimResults: boolean
        maxAlternatives: number
        onresult: ((event: { results: Array<Array<{ transcript: string }>> }) => void) | null
        onerror: (() => void) | null
        onend: (() => void) | null
        start: () => void
      }
    }).SpeechRecognition || (window as typeof window & {
      webkitSpeechRecognition?: typeof SpeechRecognition
    }).webkitSpeechRecognition

    if (!SpeechRecognition) {
      setResponse('Browser speech recognition is not available.')
      return
    }

    const recognition = new SpeechRecognition()
    recognition.lang = 'en-US'
    recognition.interimResults = false
    recognition.maxAlternatives = 1
    setIsListening(true)
    recognition.onresult = (event) => handleTranscript(event.results[0][0].transcript)
    recognition.onerror = () => {
      setResponse('Voice recognition failed. Please try again.')
      setIsListening(false)
    }
    recognition.onend = () => setIsListening(false)
    recognition.start()
  }

  const handleTranscript = (text: string) => {
    setCommand(text)
    const normalized = text.toLowerCase()
    let nextResponse = 'Command captured. No AI action was executed.'

    if (normalized.includes('lead')) {
      nextResponse = 'Opening the live leads workflow.'
      router.push('/leads')
    } else if (normalized.includes('photo') && normalized.includes('estimate')) {
      nextResponse = 'Opening the photo-estimate workflow.'
      router.push('/photo-estimate')
    } else if (normalized.includes('schedule') || normalized.includes('appointment')) {
      nextResponse = 'Opening the schedule workflow.'
      router.push('/schedule')
    } else if (normalized.includes('inspection')) {
      nextResponse = 'The inspection workflow is not directly routed by voice yet. No inspection was created.'
    }

    setResponse(nextResponse)
    setHistory((previous) => [
      { command: text, response: nextResponse, time: new Date().toLocaleTimeString() },
      ...previous,
    ])
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-blue-600 text-white shadow-lg sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center">
          <button onClick={() => router.back()} className="text-white mr-3 text-xl" aria-label="Go back">←</button>
          <h1 className="text-xl font-bold">Voice Commands</h1>
        </div>
      </header>

      <main className="p-4">
        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <p className="font-semibold">Browser speech recognition</p>
          <p className="text-xs text-gray-500 mt-1">
            Voice can capture a command and route to supported existing screens. It does not invent results or claim
            that an AI workflow ran when one did not.
          </p>
        </div>

        <button
          onClick={startVoiceRecognition}
          disabled={isListening}
          className="w-full bg-blue-600 text-white py-4 rounded-lg font-semibold disabled:opacity-50"
        >
          {isListening ? 'Listening…' : 'Start Voice Command'}
        </button>

        {command && (
          <div className="mt-4 bg-white rounded-lg shadow p-4">
            <p className="text-xs text-gray-400">Captured command</p>
            <p className="font-medium">{command}</p>
          </div>
        )}

        {response && (
          <div className="mt-2 bg-white rounded-lg shadow p-4">
            <p className="text-xs text-gray-400">Result</p>
            <p className="text-gray-700">{response}</p>
          </div>
        )}

        <div className="mt-4 bg-white rounded-lg shadow p-4">
          <h3 className="font-semibold text-sm mb-2">Supported navigation examples</h3>
          <ul className="text-sm text-gray-600 space-y-1">
            {voiceCommands.map((item) => <li key={item}>• {item}</li>)}
          </ul>
        </div>

        {history.length > 0 && (
          <div className="mt-4 bg-white rounded-lg shadow p-4">
            <h3 className="font-semibold text-sm mb-3">Command history</h3>
            {history.map((item, index) => (
              <div key={index} className="border-b last:border-0 py-2">
                <p className="text-sm font-medium">{item.command}</p>
                <p className="text-xs text-gray-500">{item.response} · {item.time}</p>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
