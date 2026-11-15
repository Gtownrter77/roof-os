'use client'

import { useEffect, useState } from 'react'
import {
  DEFAULT_ROOFING_WORKFLOW_PREFS,
  ROOFING_WORKFLOW_PREFS_KEY,
  loadRoofingWorkflowPreferences,
  saveRoofingWorkflowPreferences,
  type RoofingWorkflowPreferences,
} from '../lib/roofing-workflow-preferences'

const fields: Array<{ key: keyof RoofingWorkflowPreferences; name: string; description: string }> = [
  { key: 'autoAddressLookup', name: 'Automatic address lookup', description: 'After you enter a full address on /measure, automatically request the map after 1.2 seconds. Off by default.' },
  { key: 'selectSingleFootprint', name: 'Auto-select a single footprint', description: 'If the map returns exactly one building, select it for preview. Never auto-approve a measurement.' },
  { key: 'showReviewChecklist', name: 'Show roofing review checklist', description: 'Display the same measurement, evidence, and supplement review gates in every roofing wizard.' },
]

export default function RoofingWorkflowSettings({ compact = false }: { compact?: boolean }) {
  const [prefs, setPrefs] = useState<RoofingWorkflowPreferences>({ ...DEFAULT_ROOFING_WORKFLOW_PREFS })
  useEffect(() => {
    const refresh = () => setPrefs(loadRoofingWorkflowPreferences())
    refresh()
    window.addEventListener('storage', refresh)
    window.addEventListener('roofos-roofing-preferences-changed', refresh)
    return () => {
      window.removeEventListener('storage', refresh)
      window.removeEventListener('roofos-roofing-preferences-changed', refresh)
    }
  }, [])
  function update(key: keyof RoofingWorkflowPreferences, checked: boolean) {
    const next = { ...prefs, [key]: checked }
    setPrefs(next)
    saveRoofingWorkflowPreferences(next)
  }
  return <section aria-label="Roofing workflow automation settings" className="glass rounded-xl border border-cyan-400/20 p-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="font-semibold">Roofing workflow automations</h2>
      <span className="text-xs text-slate-400">Saved on this browser only</span>
    </div>
    <p className="mt-1 text-xs text-slate-400">No charges, outbound actions, roof quantities, purchases, insurer submissions, or agent permissions are authorized by these switches.</p>
    <div className={compact ? 'mt-2 space-y-2' : 'mt-4 space-y-4'}>
      {fields.map((field) => <label className="flex items-start justify-between gap-3" key={field.key}>
        <span><span className="block text-sm font-medium">{field.name}</span><span className="block text-xs text-slate-400">{field.description}</span></span>
        <input type="checkbox" checked={prefs[field.key]} onChange={(event) => update(field.key, event.target.checked)} aria-label={field.name} className="mt-1 h-4 w-4 shrink-0" />
      </label>)}
    </div>
    <button type="button" onClick={() => {
      setPrefs({ ...DEFAULT_ROOFING_WORKFLOW_PREFS })
      saveRoofingWorkflowPreferences({ ...DEFAULT_ROOFING_WORKFLOW_PREFS })
    }} className="mt-4 rounded border border-white/25 px-3 py-1 text-xs">Reset roofing automation settings</button>
    <p className="mt-2 text-xs text-slate-500">Key: {ROOFING_WORKFLOW_PREFS_KEY}. Never stores property addresses or customer details.</p>
  </section>
}
