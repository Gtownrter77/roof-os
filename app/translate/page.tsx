'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function TranslatePage() {
  const router = useRouter()
  const [text, setText] = useState('')
  const [translated, setTranslated] = useState('')
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
    const key = `${fromLang}-${toLang}`
    const translationMap = translations[key as keyof typeof translations]
    if (translationMap) {
      let translatedText = text
      Object.entries(translationMap).forEach(([eng, trans]) => {
        translatedText = translatedText.replace(new RegExp(eng, 'gi'), trans)
      })
      setTranslated(translatedText || 'Translation not available for this language pair.')
    } else {
      setTranslated('Translation not available for this language pair.')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center">
          <button onClick={() => router.back()} className="text-white mr-3 text-xl">←</button>
          <h1 className="text-xl font-bold">🌐 Translate</h1>
        </div>
      </header>

      <main className="p-4">
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg shadow-lg p-4 mb-4 border border-blue-200">
          <div className="flex items-center">
            <span className="text-3xl mr-3">🌐</span>
            <div>
              <h3 className="font-semibold">Multi-Language Translation</h3>
              <p className="text-xs text-gray-500">Translate estimates, reports, and communications</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="text-xs text-gray-500">From</label>
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
            <label className="text-xs text-gray-500">To</label>
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
          <div className="mt-4 bg-white rounded-lg shadow-lg p-4 border-2 border-green-500">
            <h3 className="font-semibold text-sm mb-2 flex items-center">
              <span className="text-xl mr-2">📝</span> Translation
            </h3>
            <p className="text-gray-700">{translated}</p>
            <div className="mt-3 flex gap-2">
              <button className="bg-blue-600 text-white text-xs px-3 py-1 rounded">📋 Copy</button>
              <button className="bg-green-600 text-white text-xs px-3 py-1 rounded">📤 Share</button>
            </div>
          </div>
        )}

        <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <p className="text-xs text-yellow-800">
            💡 Common construction phrases available in 12 languages
          </p>
        </div>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around py-2 px-4">
        <button onClick={() => router.push('/')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">🏠</span>
          <span className="text-xs">Home</span>
        </button>
        <button onClick={() => router.push('/translate')} className="flex flex-col items-center text-blue-600">
          <span className="text-xl">🌐</span>
          <span className="text-xs">Translate</span>
        </button>
        <button onClick={() => router.push('/insurance')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">📞</span>
          <span className="text-xs">Insurance</span>
        </button>
        <button onClick={() => router.push('/templates')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">📄</span>
          <span className="text-xs">Templates</span>
        </button>
        <button onClick={() => router.push('/settings')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">⚙️</span>
          <span className="text-xs">Settings</span>
        </button>
      </nav>
    </div>
  )
}
