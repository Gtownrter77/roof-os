'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { smartBack } from '../../lib/smart-back'

export default function TranslatePage() {
  const router = useRouter()
  const [text, setText] = useState('')
  const [translated, setTranslated] = useState('')
  const [actionMessage, setActionMessage] = useState('')
  const [fromLang, setFromLang] = useState('en')
  const [toLang, setToLang] = useState('es')

  const languages = [
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'es', name: 'Spanish', flag: '🇪🇸' },
    { code: 'fr', name: 'French', flag: '🇫🇷' },
    { code: 'de', name: 'German', flag: '🇩🇪' },
    { code: 'pt', name: 'Portuguese', flag: '🇵🇹' },
    { code: 'it', name: 'Italian', flag: '🇮🇹' },
    { code: 'zh', name: 'Chinese', flag: '🇨🇳' },
    { code: 'ja', name: 'Japanese', flag: '🇯🇵' },
    { code: 'ko', name: 'Korean', flag: '🇰🇷' },
    { code: 'ru', name: 'Russian', flag: '🇷🇺' },
    { code: 'ar', name: 'Arabic', flag: '🇸🇦' },
    { code: 'hi', name: 'Hindi', flag: '🇮🇳' },
  ]

  const translations: Record<string, Record<string, string>> = {
    'en-es': {
      'Roof Inspection': 'Inspección de Techo',
      'Estimate': 'Presupuesto',
      'Damage': 'Daño',
      'Repair': 'Reparación',
      'Materials': 'Materiales',
      'Labor': 'Mano de Obra',
      'Total': 'Total',
      'Schedule': 'Programar',
      'Address': 'Dirección',
      'Phone': 'Teléfono',
      'Email': 'Correo Electrónico',
    },
    'en-fr': {
      'Roof Inspection': 'Inspection de Toit',
      'Estimate': 'Devis',
      'Damage': 'Dommage',
      'Repair': 'Réparation',
      'Materials': 'Matériaux',
      'Labor': 'Main-d\'œuvre',
      'Total': 'Total',
      'Schedule': 'Planifier',
      'Address': 'Adresse',
      'Phone': 'Téléphone',
      'Email': 'Email',
    },
    'en-de': {
      'Roof Inspection': 'Dachinspektion',
      'Estimate': 'Kostenvoranschlag',
      'Damage': 'Schaden',
      'Repair': 'Reparatur',
      'Materials': 'Materialien',
      'Labor': 'Arbeitskosten',
      'Total': 'Gesamt',
      'Schedule': 'Termin vereinbaren',
      'Address': 'Adresse',
      'Phone': 'Telefon',
      'Email': 'E-Mail',
    }
  }

  const translateText = () => {
    setActionMessage('')
    const trimmed = text.trim()
    if (!trimmed) {
      setTranslated('')
      setActionMessage('Enter text to translate.')
      return
    }

    const key = fromLang + '-' + toLang
    const translationMap = translations[key as keyof typeof translations]
    if (!translationMap) {
      setTranslated('')
      setActionMessage('This language pair is not available in the local construction phrasebook yet.')
      return
    }

    let translatedText = text
    Object.entries(translationMap).forEach(([source, target]) => {
      translatedText = translatedText.replace(new RegExp(source, 'gi'), target)
    })
    setTranslated(translatedText)
  }

  const copyTranslation = async () => {
    if (!translated) return
    try {
      await navigator.clipboard.writeText(translated)
      setActionMessage('Translation copied.')
    } catch {
      setActionMessage('Copy is not available in this browser.')
    }
  }

  const shareTranslation = async () => {
    if (!translated) return
    if (!navigator.share) {
      setActionMessage('Sharing is not available in this browser.')
      return
    }
    try {
      await navigator.share({ text: translated })
      setActionMessage('Translation shared.')
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      setActionMessage('Could not share the translation.')
    }
  }

  return (
    <div className="space-y-4 pb-4">
      <header className="glass rounded-xl mb-4">
        <div className="px-4 py-3 flex items-center">
          <button onClick={() => smartBack(router)} className="mr-3 text-xl text-cyan-300">←</button>
          <h1 className="text-xl font-bold">🌐 Translate</h1>
        </div>
      </header>

      <main className="p-4">
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg shadow-lg p-4 mb-4 border border-cyan-400/30">
          <div className="flex items-center">
            <span className="text-3xl mr-3">🌐</span>
            <div>
              <h3 className="font-semibold">Multi-Language Translation</h3>
              <p className="text-xs text-slate-400">Translate common construction phrases without a remote translation service.</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="text-xs text-slate-400">From</label>
            <select
              value={fromLang}
              onChange={(e) => setFromLang(e.target.value)}
              className="w-full p-2 border rounded-lg text-sm"
            >
              {languages.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.flag} {lang.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-400">To</label>
            <select
              value={toLang}
              onChange={(e) => setToLang(e.target.value)}
              className="w-full p-2 border rounded-lg text-sm"
            >
              {languages.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.flag} {lang.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Enter text to translate..."
          className="w-full p-3 border rounded-lg h-32 focus:ring-2 focus:ring-blue-500"
        />

        <button
          onClick={translateText}
          className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 rounded-lg font-semibold mt-3"
        >
          🌐 Translate
        </button>

        {translated && (
          <div className="mt-4 glass rounded-xl p-4 border-2 border-green-500">
            <h3 className="font-semibold text-sm mb-2 flex items-center">
              <span className="text-xl mr-2">📝</span> Translation
            </h3>
            <p className="text-slate-200">{translated}</p>
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={() => void copyTranslation()} className="bg-blue-600 text-white text-xs px-3 py-1 rounded">📋 Copy</button>
              <button type="button" onClick={() => void shareTranslation()} className="bg-green-600 text-white text-xs px-3 py-1 rounded">📤 Share</button>
            </div>
          </div>
        )}

        {actionMessage && <p className="mt-3 text-sm text-cyan-200 bg-cyan-400/10 rounded p-3" role="status">{actionMessage}</p>}
        <div className="mt-4 bg-amber-400/10 border border-yellow-200 rounded-lg p-3">
          <p className="text-xs text-yellow-800">
            💡 The built-in phrasebook currently supports English to Spanish, French, and German.
          </p>
        </div>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-30 flex justify-around border-t border-white/10 bg-[#070b14]/95 py-2 px-4 backdrop-blur lg:hidden">
        <button onClick={() => router.push('/')} className="flex flex-col items-center text-slate-400">
          <span className="text-xl">🏠</span>
          <span className="text-xs">Home</span>
        </button>
        <button onClick={() => router.push('/translate')} className="flex flex-col items-center text-cyan-300">
          <span className="text-xl">🌐</span>
          <span className="text-xs">Translate</span>
        </button>
        <button onClick={() => router.push('/insurance')} className="flex flex-col items-center text-slate-400">
          <span className="text-xl">📞</span>
          <span className="text-xs">Insurance</span>
        </button>
        <button onClick={() => router.push('/templates')} className="flex flex-col items-center text-slate-400">
          <span className="text-xl">📄</span>
          <span className="text-xs">Templates</span>
        </button>
        <button onClick={() => router.push('/settings')} className="flex flex-col items-center text-slate-400">
          <span className="text-xl">⚙️</span>
          <span className="text-xs">Settings</span>
        </button>
      </nav>
    </div>
  )
}
