'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { smartBack } from '../../lib/smart-back'

type Template = { id: string; name: string; trade: string; description: string; sections: string[] }

const templates: Template[] = [
  { id: 'roof-replacement', name: 'Roof replacement', trade: 'Roofing', description: 'A complete replacement estimate organized around scope, materials, labor, cleanup, and warranty.', sections: ['Roof covering', 'Tear-off and disposal', 'Installation labor', 'Permits', 'Cleanup', 'Warranty'] },
  { id: 'repair-estimate', name: 'Roof repair', trade: 'Roofing', description: 'A focused repair estimate for storm damage, leaks, or isolated roof defects.', sections: ['Repair materials', 'Repair labor', 'Access / protection', 'Cleanup'] },
  { id: 'siding-install', name: 'Siding installation', trade: 'Siding', description: 'Full siding installation with accessories and trim.', sections: ['Siding materials', 'Installation labor', 'Trim', 'Soffit', 'Fascia'] },
  { id: 'gutter-replacement', name: 'Gutter replacement', trade: 'Gutters', description: 'Gutters, downspouts, guards, and installation.', sections: ['Gutters', 'Downspouts', 'Guards', 'Installation'] },
  { id: 'window-replacement', name: 'Window replacement', trade: 'Exterior', description: 'Window units, installation, trim, and disposal.', sections: ['Window units', 'Installation', 'Trim', 'Disposal'] },
]

export default function TemplatesPage() {
  const router = useRouter()
  const [selectedTemplate, setSelectedTemplate] = useState('roof-replacement')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const selected = templates.find((template) => template.id === selectedTemplate) ?? templates[0]

  const persistTemplate = async () => {
    setSaving(true); setMessage('')
    try {
      const response = await fetch('/api/estimate-templates', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: selected.name, description: selected.description, items: selected.sections.map((section, index) => ({ itemCode: `${selected.id}-${index + 1}`, description: section, category: section.toLowerCase().includes('labor') || section.toLowerCase().includes('installation') ? 'labor' : 'material', unit: 'EA', defaultQuantity: 1 })) }) })
      const result = await response.json().catch(() => ({}))
      setMessage(response.ok ? `${selected.name} was saved as a draft workspace template.` : (result.error ?? 'Could not save template.'))
    } catch { setMessage('Could not save template. Check your connection.') } finally { setSaving(false) }
  }

  return <main className="min-h-screen space-y-4 bg-slate-950 pb-8 text-slate-100"><header className="glass border-b border-white/10"><div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4"><div className="flex items-center"><button onClick={() => smartBack(router)} className="mr-3 text-xl text-cyan-300" aria-label="Go back">←</button><div><p className="ops-label">Estimate system</p><h1 className="text-2xl font-black">Templates</h1></div></div><button onClick={() => router.push('/estimate/new')} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white">New estimate</button></div></header><div className="mx-auto grid max-w-6xl gap-5 px-4 lg:grid-cols-[1.3fr_.7fr]"><section><div className="mb-4 rounded-xl border border-cyan-400/20 bg-cyan-400/10 p-4"><h2 className="font-semibold text-cyan-100">Start with a standardized job scope</h2><p className="mt-1 text-sm text-cyan-200/80">Choose a trade and job type, then ROOF/OS carries the starter sections into a draft estimate. Add measurements, adjust quantities, and enter verified prices before sending for review.</p></div>{message && <p role="status" className="mb-3 rounded-lg border border-emerald-400/30 bg-emerald-400/10 p-3 text-sm text-emerald-200">{message}</p>}<div className="grid gap-3 sm:grid-cols-2">{templates.map((template) => <button type="button" key={template.id} onClick={() => setSelectedTemplate(template.id)} className={`rounded-xl border p-4 text-left transition ${selectedTemplate === template.id ? 'border-cyan-400 bg-cyan-400/10' : 'border-white/10 bg-slate-900 hover:border-cyan-400/40'}`}><div className="flex items-center justify-between gap-2"><h3 className="font-bold">{template.name}</h3><span className="rounded bg-white/10 px-2 py-1 text-[11px] text-slate-300">{template.trade}</span></div><p className="mt-2 text-sm text-slate-400">{template.description}</p><div className="mt-3 flex flex-wrap gap-1">{template.sections.map((section) => <span key={section} className="rounded bg-slate-800 px-2 py-1 text-[11px] text-slate-300">{section}</span>)}</div></button>)}</div></section><aside className="h-fit rounded-xl border border-white/10 bg-slate-900 p-5"><p className="ops-label">Selected template</p><h2 className="mt-1 text-xl font-bold">{selected.name}</h2><p className="mt-2 text-sm text-slate-400">{selected.description}</p><div className="mt-4 space-y-2">{selected.sections.map((section, index) => <div key={section} className="flex gap-3 rounded-lg border border-white/10 p-2 text-sm"><span className="text-cyan-300">{String(index + 1).padStart(2, '0')}</span><span>{section}</span></div>)}</div><button type="button" onClick={() => router.push(`/estimate/new?template=${selected.id}`)} className="mt-5 w-full rounded-lg bg-emerald-600 py-3 font-bold text-white hover:bg-emerald-500">Use this template</button><button type="button" onClick={() => void persistTemplate()} disabled={saving} className="mt-2 w-full rounded-lg border border-cyan-500 px-3 py-2 text-sm text-cyan-200 disabled:opacity-50">{saving ? 'Saving…' : 'Save to workspace templates'}</button><p className="mt-3 text-[11px] text-amber-200/80">Saved workspace templates remain draft versions until your team reviews pricing and publishes them.</p></aside></div></main>
}
