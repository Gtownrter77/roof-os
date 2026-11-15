'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { loadRoofingWorkflowPreferences, type RoofingWorkflowPreferences } from '../lib/roofing-workflow-preferences'

const links = [
  { href: '/measure', label: 'Aerial & measurements' },
  { href: '/sketch', label: 'Manual sketch' },
  { href: '/estimate/new', label: 'Estimate wizard' },
  { href: '/supplement', label: 'Supplement wizard' },
  { href: '/supplement/review', label: 'Supplement review' },
  { href: '/settings', label: 'Settings' },
]

export default function RoofingWizardNavigator({ active }: { active?: string }) {
  const [prefs, setPrefs] = useState<RoofingWorkflowPreferences | null>(null)
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
  return <nav aria-label="Roofing workflow stages" className="glass rounded-lg border border-white/10 p-3">
    <p className="mb-2 text-xs font-bold uppercase tracking-widest text-cyan-300">Roofing workflow · switch steps</p>
    <div className="flex flex-wrap gap-2">
      {links.map((link) => <Link key={link.href} href={link.href} aria-current={active === link.href ? 'page' : undefined}
        className={'rounded border px-3 py-2 text-xs ' + (active === link.href ? 'border-cyan-400 text-cyan-200' : 'border-white/20 text-slate-300')}>
        {link.label}</Link>)}
    </div>
    {prefs?.showReviewChecklist && <p className="mt-3 text-xs text-amber-200">
      Review gate: verify address and roof plane, imagery provenance, field scale and pitch, measurements, evidence and owner pricing. No automatic carrier submissions or material orders.
    </p>}
  </nav>
}
