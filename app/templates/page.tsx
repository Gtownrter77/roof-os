'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const templates = [
  { id: 'roof-replacement', name: 'Roof Replacement', description: 'Complete roof replacement estimate with materials and labor', sections: ['Materials', 'Labor', 'Permits', 'Cleanup', 'Warranty'] },
  { id: 'siding-install', name: 'Siding Installation', description: 'Full siding installation with accessories and trim', sections: ['Materials', 'Labor', 'Trim', 'Soffit', 'Fascia'] },
  { id: 'window-replacement', name: 'Window Replacement', description: 'Professional window replacement with installation', sections: ['Materials', 'Labor', 'Installation', 'Trim'] },
  { id: 'deck-construction', name: 'Deck Construction', description: 'Complete deck build with framing and features', sections: ['Framing', 'Decking', 'Railing', 'Stairs', 'Lighting'] },
  { id: 'gutter-replacement', name: 'Gutter Replacement', description: 'Full gutter system with downspouts and guards', sections: ['Gutters', 'Downspouts', 'Guards', 'Installation'] },
  { id: 'repair-estimate', name: 'Repair Estimate', description: 'General repair estimate for exterior work', sections: ['Materials', 'Labor', 'Cleanup', 'Permits'] },
]

export default function TemplatesPage() {
  const router = useRouter()
  const [selectedTemplate, setSelectedTemplate] = useState('')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)

  const persistTemplate = async () => {
    const template = templates.find((item) => item.id === selectedTemplate)
    if (!template) return
    setSaving(true); setMessage('')
    const response = await fetch('/api/estimate-templates', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: template.name, description: template.description, items: template.sections.map((section) => ({ itemCode: `${template.id}-${section.toLowerCase().replace(/\s+/g, '-')}`, description: section, category: section.toLowerCase().includes('labor') ? 'labor' : 'material', unit: 'EA', defaultQuantity: 1 })) }) })
    const result = await response.json()
    setMessage(response.ok ? `Saved ${template.name} as a draft template. It still needs price-book and approval review.` : (result.error ?? 'Could not save template.'))
    setSaving(false)
  }

  return <div className="min-h-screen bg-gray-50 pb-20"><header className="bg-gradient-to-r from-blue-600 to-green-600 text-white shadow-lg sticky top-0 z-10"><div className="px-4 py-3 flex items-center"><button onClick={() => router.back()} className="mr-3 text-xl">←</button><h1 className="text-xl font-bold">📄 Estimate Templates</h1></div></header><main className="p-4"><div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4"><p className="text-sm text-blue-800">Templates are persisted as draft versions. Attach an approved price book and review before external use.</p></div>{message && <p className="text-sm text-green-700 mb-3" role="status">{message}</p>}<div className="grid grid-cols-1 gap-3">{templates.map((template) => <div key={template.id} className={`bg-white rounded-lg shadow-lg p-4 border-2 transition cursor-pointer ${selectedTemplate === template.id ? 'border-blue-500' : 'border-transparent'}`} onClick={() => setSelectedTemplate(template.id)}><h3 className="font-semibold text-sm">{template.name}</h3><p className="text-xs text-gray-500 mt-1">{template.description}</p><div className="mt-2 flex flex-wrap gap-1">{template.sections.map((section) => <span key={section} className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded">{section}</span>)}</div>{selectedTemplate === template.id && <button onClick={(event) => { event.stopPropagation(); void persistTemplate() }} disabled={saving} className="w-full mt-3 bg-blue-600 text-white py-2 rounded-lg text-sm font-semibold disabled:opacity-60">{saving ? 'Saving…' : 'Save Draft Template'}</button>}</div>)}</div></main><nav className="fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around py-2 px-4"><button onClick={() => router.push('/')} className="text-gray-400">🏠 Home</button><button onClick={() => router.push('/templates')} className="text-blue-600">📄 Templates</button><button onClick={() => router.push('/settings')} className="text-gray-400">⚙️ Settings</button></nav></div>
}
