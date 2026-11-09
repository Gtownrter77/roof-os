'use client'

import { useEffect, useState } from 'react'

type TourStep = {
  title: string
  description: string
  section: number
  target: string
}

const TOUR_STEPS: TourStep[] = [
  {
    title: 'Meet your local setup guide',
    description: 'The guide can talk through your business and suggest profile details. It cannot apply or save a suggestion without your approval.',
    section: 0,
    target: 'onboarding-assistant-title',
  },
  {
    title: 'Business basics',
    description: 'Choose the type of roofing work you do and your approximate crew size. “Not sure” is a valid answer.',
    section: 0,
    target: 'step-heading',
  },
  {
    title: 'Service area',
    description: 'Add the five-digit ZIP codes where you usually work. These are profile preferences, not dispatch boundaries.',
    section: 1,
    target: 'step-heading',
  },
  {
    title: 'Work mix',
    description: 'Describe roofing systems, related services, and where your leads come from. Keep it factual; you can edit it later.',
    section: 2,
    target: 'step-heading',
  },
  {
    title: 'Workflow',
    description: 'Tell ROOF/OS how inspections, estimates, production, and customer contact work today. This does not change company policy.',
    section: 3,
    target: 'step-heading',
  },
  {
    title: 'Your first goal',
    description: 'Name the first improvement you want ROOF/OS to help with. This is a planning preference, not an automated task.',
    section: 4,
    target: 'step-heading',
  },
  {
    title: 'Save when you are ready',
    description: 'Save progress to keep a draft. Mark setup complete only when the profile is accurate. Neither action activates operational features.',
    section: 4,
    target: 'workspace-save-progress',
  },
]

type Props = {
  onSelectSection: (section: number) => void
}

export default function WorkspaceSetupTour({ onSelectSection }: Props) {
  const [active, setActive] = useState(false)
  const [index, setIndex] = useState(0)
  const current = TOUR_STEPS[index]

  useEffect(() => {
    if (!active) return
    onSelectSection(current.section)
    document.getElementById(current.target)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [active, current.section, current.target, onSelectSection])

  function start() {
    setIndex(0)
    setActive(true)
  }

  function next() {
    if (index === TOUR_STEPS.length - 1) {
      setActive(false)
      setIndex(0)
      return
    }
    setIndex((value) => value + 1)
  }

  if (!active) {
    return (
      <div className="mb-6 rounded-xl border border-violet-300/25 bg-violet-950/20 p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-violet-100">New here? Take the guided tour.</p>
            <p className="mt-1 text-xs text-slate-400">A short walkthrough of the assistant, profile sections, and save controls.</p>
          </div>
          <button type="button" onClick={start} className="rounded-lg border border-violet-300/40 px-3 py-2 text-xs font-semibold text-violet-100 hover:bg-violet-300/10">Start tour</button>
        </div>
      </div>
    )
  }

  return (
    <section className="mb-6 rounded-xl border border-violet-300/35 bg-violet-950/30 p-4" aria-label="Interactive workspace setup tour" aria-live="polite">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-violet-200">Guided tour · Step {index + 1} of {TOUR_STEPS.length}</p>
        <button type="button" onClick={() => setActive(false)} className="rounded-md px-2 py-1 text-xs text-slate-300 hover:bg-white/10">Exit tour</button>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-violet-300 transition-all" style={{ width: `${((index + 1) / TOUR_STEPS.length) * 100}%` }} />
      </div>
      <h2 className="mt-3 text-base font-semibold text-white">{current.title}</h2>
      <p className="mt-1 text-sm leading-relaxed text-slate-300">{current.description}</p>
      <div className="mt-4 flex flex-wrap justify-between gap-2">
        <button type="button" onClick={() => setIndex((value) => Math.max(0, value - 1))} disabled={index === 0} className="rounded-lg border border-white/15 px-3 py-2 text-xs text-slate-200 disabled:opacity-30">Back</button>
        <button type="button" onClick={next} className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-500">{index === TOUR_STEPS.length - 1 ? 'Finish tour' : 'Next'}</button>
      </div>
    </section>
  )
}
