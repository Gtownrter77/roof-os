'use client'

import Link from 'next/link'
import { CloudLightning, BriefcaseBusiness } from 'lucide-react'
import { applyDashboardSkin } from '../lib/theme/dashboard-skin'
import { useDashboardSkin } from './useDashboardSkin'

type Props = { compact?: boolean; className?: string }

export default function DashboardSkinToggle({ compact = false, className = '' }: Props) {
  const stormOn = useDashboardSkin()
  return (
    <div className="inline-flex flex-wrap items-center gap-2"><button
      type="button"
      role="switch"
      aria-checked={stormOn}
      aria-label="Storm Mode dashboard skin"
      title={stormOn ? 'Storm Mode on. Switch to Professional Mode.' : 'Professional Mode on. Switch to Storm Mode.'}
      onClick={() => applyDashboardSkin(!stormOn)}
      className={`dashboard-skin-switch inline-flex items-center justify-center gap-2 rounded-lg border border-white/20 px-3 py-2 text-xs font-semibold text-slate-100 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 ${className}`}
    >
      {stormOn ? <CloudLightning size={16} aria-hidden="true" /> : <BriefcaseBusiness size={16} aria-hidden="true" />}
      <span>{stormOn ? 'Storm Mode' : 'Professional Mode'}</span>
      {!compact && <span className={`dashboard-skin-knob ${stormOn ? 'dashboard-skin-knob-on' : ''}`} aria-hidden="true"><span /></span>}
    </button><Link href="/themes" className="theme-collection-link">{compact ? 'Themes' : 'Choose a theme ↗'}</Link></div>
  )
}
