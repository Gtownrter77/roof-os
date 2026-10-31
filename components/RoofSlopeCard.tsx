'use client'

import { useMemo, useState } from 'react'
import { calculateRoofSlope } from '../lib/roof-slope'

export default function RoofSlopeCard({ compact = false }: { compact?: boolean }) {
  const [rise, setRise] = useState('')
  const [run, setRun] = useState('12')
  const result = useMemo(() => calculateRoofSlope(Number(rise), Number(run)), [rise, run])

  return (
    <section aria-labelledby="roof-slope-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="ops-label">Human field input</p>
          <h2 id="roof-slope-heading" className="text-lg font-semibold text-white">Roof slope / pitch</h2>
          <p className="mt-1 max-w-2xl text-xs text-slate-400">
            Enter the measured rise over run. ROOF/OS calculates the familiar X/12 pitch and angle; it does not infer or certify slope from imagery.
          </p>
        </div>
        {result && <div className="rounded-lg border border-cyan-400/30 bg-cyan-400/10 px-3 py-2 text-right" role="status"><div className="text-2xl font-black text-cyan-200">{result.pitch}/12</div><div className="text-xs text-cyan-100">{result.angleDegrees}° · {result.label}</div></div>}
      </div>
      <div className={`mt-3 grid gap-3 ${compact ? 'sm:grid-cols-2' : 'sm:grid-cols-[1fr_1fr_auto]'}`}>
        <label className="text-sm text-slate-200">Rise<input value={rise} onChange={(event) => setRise(event.target.value)} inputMode="decimal" type="number" min="0" step="0.01" placeholder="6" className="mt-1 w-full rounded-lg border border-white/15 bg-black/25 p-2 text-white" /></label>
        <label className="text-sm text-slate-200">Run<input value={run} onChange={(event) => setRun(event.target.value)} inputMode="decimal" type="number" min="0.01" step="0.01" placeholder="12" className="mt-1 w-full rounded-lg border border-white/15 bg-black/25 p-2 text-white" /></label>
        {!compact && <div className="flex items-end text-xs text-slate-400">Example: 6 in rise over 12 in run = 6/12 pitch.</div>}
      </div>
      <p className="mt-3 text-[11px] text-amber-200/80">Review gate: confirm the field measurement and source before using this slope in an estimate.</p>
    </section>
  )
}
