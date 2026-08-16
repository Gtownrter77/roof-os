'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function VoiceAI() {
  const router = useRouter()
  const [isListening, setIsListening] = useState(false)
  const [command, setCommand] = useState('')
  const [response, setResponse] = useState('')
  const [history, setHistory] = useState<any[]>([])

  const voiceCommands = [
    'Show me all leads',
    'Create new inspection',
    'What\'s the weather?',
    'Generate report for 123 Main St',
    'Show my tasks',
    'Schedule appointment',
    'AI estimate for property',
    'Run supplement analysis',
    'Deploy drone scan',
    'Predict future damage'
  ]

  const processVoiceCommand = (text: string) => {
    setCommand(text)
    setIsListening(true)
    
    // Simulate AI processing
    setTimeout(() => {
      let response = ''
      if (text.includes('lead')) response = '📋 Showing all leads...'
      else if (text.includes('inspection')) response = '🔍 Creating new inspection...'
      else if (text.includes('weather')) response = '🌤️ Current weather: Sunny, 72°F'
      else if (text.includes('report')) response = '📄 Generating report...'
      else if (text.includes('task')) response = '✅ Showing your tasks...'
      else if (text.includes('schedule')) response = '📅 Opening calendar...'
      else if (text.includes('estimate')) response = '🤖 Running AI estimation...'
      else if (text.includes('supplement')) response = '📋 Analyzing supplements...'
      else if (text.includes('drone')) response = '🚁 Deploying drone...'
      else if (text.includes('predict')) response = '🧠 Running predictive analysis...'
      else response = '🤔 Command not recognized. Try one of these: ' + voiceCommands.join(', ')
      
      setResponse(response)
      setHistory([{ command: text, response: response, time: new Date().toLocaleTimeString() }, ...history])
      setIsListening(false)
    }, 1500)
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center">
          <button onClick={() => router.back()} className="text-white mr-3 text-xl">←</button>
          <h1 className="text-xl font-bold">🎤 AI Voice Command</h1>
          <span className="ml-2 bg-green-500 text-white text-xs px-2 py-0.5 rounded-full animate-pulse">LIVE</span>
        </div>
      </header>

      <main className="p-4">
        <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg shadow-lg p-6 text-center mb-4 border border-blue-200">
          <div className={`text-6xl mb-3 ${isListening ? 'animate-pulse text-red-500' : ''}`}>
            {isListening ? '🎤' : '🤖'}
          </div>
          <p className="font-semibold">Tap the button and speak your command</p>
          <p className="text-xs text-gray-400">AI-powered voice recognition</p>
        </div>

        <button 
          onClick={() => {
            // Simulate voice input
            const randomCommand = voiceCommands[Math.floor(Math.random() * voiceCommands.length)]
            processVoiceCommand(randomCommand)
          }}
          disabled={isListening}
          className={`w-full py-4 rounded-lg font-semibold text-lg ${
            isListening ? 'bg-red-600 text-white' : 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white'
          }`}
        >
          {isListening ? '⏳ Processing...' : '🎤 Start Voice Command'}
        </button>

        {command && (
          <div className="mt-4 bg-white rounded-lg shadow-lg p-4 border-l-4 border-blue-500">
            <p className="text-xs text-gray-400">Command</p>
            <p className="font-medium">"{command}"</p>
          </div>
        )}

        {response && (
          <div className="mt-2 bg-white rounded-lg shadow-lg p-4 border-l-4 border-green-500">
            <p className="text-xs text-gray-400">Response</p>
            <p className="text-gray-700">{response}</p>
          </div>
        )}

        {history.length > 0 && (
          <div className="mt-4 bg-white rounded-lg shadow-lg p-4">
            <h3 className="font-semibold text-sm mb-3 flex justify-between">
              <span>📜 Command History</span>
              <span className="text-xs text-gray-400">{history.length} commands</span>
            </h3>
            {history.map((item, i) => (
              <div key={i} className="border-b last:border-0 py-2">
                <div className="flex justify-between">
                  <p className="text-sm font-medium">{item.command}</p>
                  <p className="text-xs text-gray-400">{item.time}</p>
                </div>
                <p className="text-xs text-gray-500">{item.response}</p>
              </div>
            ))}
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around py-2 px-4">
        <button onClick={() => router.push('/')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">🏠</span>
          <span className="text-xs">Home</span>
        </button>
        <button onClick={() => router.push('/voice-ai')} className="flex flex-col items-center text-blue-600">
          <span className="text-xl">🎤</span>
          <span className="text-xs">Voice</span>
        </button>
        <button onClick={() => router.push('/predict')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">🧠</span>
          <span className="text-xs">AI</span>
        </button>
        <button onClick={() => router.push('/drone')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">🚁</span>
          <span className="text-xs">Drone</span>
        </button>
        <button onClick={() => router.push('/settings')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">⚙️</span>
          <span className="text-xs">Settings</span>
        </button>
      </nav>
    </div>
  )
}
