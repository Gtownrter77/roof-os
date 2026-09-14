'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function TemplatesPage() {
  const router = useRouter()
  const [selectedTemplate, setSelectedTemplate] = useState('')

  const templates = [
    {
      id: 'roof-replacement',
      name: '🏠 Roof Replacement',
      description: 'Complete roof replacement estimate with all materials and labor',
      sections: ['Materials', 'Labor', 'Permits', 'Cleanup', 'Warranty'],
      estimatedRange: '$8,000 - $15,000'
    },
    {
      id: 'siding-install',
      name: '🏠 Siding Installation',
      description: 'Full siding installation with all accessories and trim',
      sections: ['Materials', 'Labor', 'Trim', 'Soffit', 'Fascia'],
      estimatedRange: '$6,000 - $12,000'
    },
    {
      id: 'window-replacement',
      name: '🪟 Window Replacement',
      description: 'Professional window replacement with installation',
      sections: ['Materials', 'Labor', 'Installation', 'Trim'],
      estimatedRange: '$600 - $1,200 per window'
    },
    {
      id: 'deck-construction',
      name: '🪵 Deck Construction',
      description: 'Complete deck build with all materials and features',
      sections: ['Framing', 'Decking', 'Railing', 'Stairs', 'Lighting'],
      estimatedRange: '$8,000 - $20,000'
    },
    {
      id: 'gutter-replacement',
      name: '🌧️ Gutter Replacement',
      description: 'Full gutter system with downspouts and guards',
      sections: ['Gutters', 'Downspouts', 'Guards', 'Installation'],
      estimatedRange: '$1,200 - $3,000'
    },
    {
      id: 'repair-estimate',
      name: '🔧 Repair Estimate',
      description: 'General repair estimate for any exterior work',
      sections: ['Materials', 'Labor', 'Cleanup', 'Permits'],
      estimatedRange: '$500 - $5,000'
    },
    {
      id: 'storm-damage',
      name: '🌪️ Storm Damage Assessment',
      description: 'Full storm damage assessment and repair estimate',
      sections: ['Damage Assessment', 'Materials', 'Labor', 'Cleanup', 'Insurance Claims'],
      estimatedRange: 'Varies'
    },
    {
      id: 'commercial-roof',
      name: '🏢 Commercial Roof',
      description: 'Commercial roofing estimate with all materials',
      sections: ['Materials', 'Labor', 'Equipment', 'Permits', 'Safety'],
      estimatedRange: '$15,000 - $50,000'
    }
  ]

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-gradient-to-r from-blue-600 to-green-600 text-white shadow-lg sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center">
          <button onClick={() => router.back()} className="text-white mr-3 text-xl">←</button>
          <h1 className="text-xl font-bold">📄 Estimate Template Prototype</h1>
          <span className="ml-2 bg-amber-500 text-white text-xs px-2 py-0.5 rounded-full">NOT SHIPPED</span>
        </div>
      </header>

      <main className="p-4">
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
          <p className="text-sm text-amber-800">Prototype fixtures only. Templates are not persisted and cannot create customer estimates.</p>
        </div>

        <div className="grid grid-cols-1 gap-3">
          {templates.map((template) => (
            <div 
              key={template.id}
              className={`bg-white rounded-lg shadow-lg p-4 border-2 transition cursor-pointer ${
                selectedTemplate === template.id ? 'border-blue-500' : 'border-transparent'
              }`}
              onClick={() => setSelectedTemplate(template.id)}
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold text-sm">{template.name}</h3>
                  <p className="text-xs text-gray-500 mt-1">{template.description}</p>
                </div>
                <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                  {template.estimatedRange}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {template.sections.map((section, i) => (
                  <span key={i} className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded">
                    {section}
                  </span>
                ))}
              </div>
              {selectedTemplate === template.id && (
                <button className="w-full mt-3 bg-blue-600 text-white py-2 rounded-lg text-sm font-semibold">
                  📄 Generate Estimate
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button className="bg-green-600 text-white py-2 rounded-lg text-sm font-semibold">
            📤 Export All
          </button>
          <button className="bg-purple-600 text-white py-2 rounded-lg text-sm font-semibold">
            ✨ Create Custom
          </button>
        </div>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around py-2 px-4">
        <button onClick={() => router.push('/')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">🏠</span>
          <span className="text-xs">Home</span>
        </button>
        <button onClick={() => router.push('/templates')} className="flex flex-col items-center text-blue-600">
          <span className="text-xl">📄</span>
          <span className="text-xs">Templates</span>
        </button>
        <button onClick={() => router.push('/sketch')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">✏️</span>
          <span className="text-xs">Sketch</span>
        </button>
        <button onClick={() => router.push('/insurance')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">📞</span>
          <span className="text-xs">Insurance</span>
        </button>
        <button onClick={() => router.push('/settings')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">⚙️</span>
          <span className="text-xs">Settings</span>
        </button>
      </nav>
    </div>
  )
}
