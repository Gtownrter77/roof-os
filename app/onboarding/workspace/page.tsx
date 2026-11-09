'use client'

import { useEffect, useState } from 'react'
import type { OnboardingProfile, OnboardingProfileStatus } from '../../../lib/onboarding-profile'

const EMPTY_PROFILE: OnboardingProfile = {
  companyType: 'unsure',
  serviceZipCodes: [],
  roofingSystems: [],
  relatedServices: [],
  crewCountBand: 'unsure',
  leadSources: [],
  inspectionStyle: 'unsure',
  estimateWorkflow: 'unsure',
  productionWorkflow: 'unsure',
  customerContactPreferences: ['unsure'],
  primaryGoal: '',
}

const STEPS = ['Business', 'Service area', 'Work mix', 'Workflow', 'Goal']

function splitList(value: string) {
  return [...new Set(value.split(',').map((item) => item.trim()).filter(Boolean))]
}

function listValue(value: string[] | undefined) {
  return (value ?? []).join(', ')
}

export default function WorkspaceOnboardingPage() {
  const [profile, setProfile] = useState<OnboardingProfile>(EMPTY_PROFILE)
  const [status, setStatus] = useState<OnboardingProfileStatus>('draft')
  const [step, setStep] = useState(0)
  const [canEdit, setCanEdit] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    let active = true
    async function loadProfile() {
      try {
        const response = await fetch('/api/onboarding/profile', { cache: 'no-store' })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Could not load workspace setup.')
        if (!active) return
        setProfile({ ...EMPTY_PROFILE, ...(data.profile ?? {}) })
        setStatus(data.status === 'completed' ? 'completed' : 'draft')
        setCanEdit(data.canEdit === true)
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : 'Could not load workspace setup.')
      } finally {
        if (active) setLoading(false)
      }
    }
    void loadProfile()
    return () => { active = false }
  }, [])

  function update<K extends keyof OnboardingProfile>(key: K, value: OnboardingProfile[K]) {
    setProfile((current) => ({ ...current, [key]: value }))
    setNotice('')
  }

  async function save(nextStatus: OnboardingProfileStatus) {
    if (!canEdit || saving) return
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const response = await fetch('/api/onboarding/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile, status: nextStatus }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not save workspace setup.')
      setProfile({ ...EMPTY_PROFILE, ...(data.profile ?? profile) })
      setStatus(data.status === 'completed' ? 'completed' : 'draft')
      setNotice(nextStatus === 'completed' ? 'Workspace setup marked complete.' : 'Progress saved. You can return and continue later.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save workspace setup.')
    } finally {
      setSaving(false)
    }
  }

  const inputClass = 'mt-1 w-full rounded-xl border border-white/15 bg-slate-950/70 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400 disabled:opacity-60'
  const labelClass = 'block text-sm font-medium text-slate-200'
  const listField = (label: string, value: string[] | undefined, onChange: (next: string[]) => void, hint: string) => (
    <label className={labelClass}>
      {label}
      <input className={inputClass} value={listValue(value)} disabled={!canEdit} onChange={(event) => onChange(splitList(event.target.value))} placeholder="Separate entries with commas" />
      <span className="mt-1 block text-xs font-normal text-slate-400">{hint}</span>
    </label>
  )

  if (loading) {
    return <main className="ops-bg flex min-h-screen items-center justify-center p-6 text-sm text-slate-300">Loading workspace setup…</main>
  }

  return (
    <main className="ops-bg min-h-screen px-4 py-8 text-white">
      <div className="mx-auto w-full max-w-3xl">
        <header className="mb-6">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">ROOF/OS · Workspace setup</p>
          <h1 className="mt-2 text-3xl font-bold">Build your company profile</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-300">Set up the basics at your own pace. You can save a draft and return later. Choose “Not sure” whenever you need to.</p>
        </header>

        <div className="mb-5 rounded-xl border border-cyan-300/20 bg-cyan-950/25 p-3 text-xs leading-relaxed text-cyan-100/80">
          These are reviewed workspace preferences only. Saving them does not change pricing, permissions, crew assignments, customer records, integrations, or live operations. AI recommendations are not connected in this phase.
        </div>

        {!canEdit && (
          <div className="mb-5 rounded-xl border border-amber-300/30 bg-amber-950/25 p-3 text-sm text-amber-100" role="status">
            You can review this workspace profile, but only a workspace administrator can change it.
          </div>
        )}

        <nav aria-label="Workspace setup steps" className="mb-6 grid grid-cols-5 gap-2">
          {STEPS.map((name, index) => (
            <button key={name} type="button" onClick={() => setStep(index)} aria-current={step === index ? 'step' : undefined} className={`rounded-lg border px-2 py-2 text-xs font-semibold transition ${step === index ? 'border-cyan-300 bg-cyan-400/15 text-cyan-100' : 'border-white/10 bg-white/5 text-slate-400 hover:text-white'}`}>
              <span className="block text-[10px] opacity-70">{index + 1}</span>{name}
            </button>
          ))}
        </nav>

        <section className="min-h-[300px] rounded-2xl border border-white/10 bg-slate-950/65 p-5 shadow-xl sm:p-7" aria-labelledby="step-heading">
          <div className="mb-5 flex items-center justify-between gap-3">
            <h2 id="step-heading" className="text-xl font-semibold">{STEPS[step]}</h2>
            <span className="text-xs text-slate-400">Step {step + 1} of {STEPS.length}</span>
          </div>

          {step === 0 && (
            <div className="space-y-4">
              <p className="text-sm text-slate-300">What kind of roofing work does your company primarily handle?</p>
              <label className={labelClass}>Business type
                <select className={inputClass} value={profile.companyType ?? 'unsure'} disabled={!canEdit} onChange={(event) => update('companyType', event.target.value as NonNullable<OnboardingProfile['companyType']>)}>
                  <option value="unsure">Not sure yet</option><option value="residential">Residential</option><option value="commercial">Commercial</option><option value="both">Both</option>
                </select>
              </label>
              <label className={labelClass}>Approximate crew size
                <select className={inputClass} value={profile.crewCountBand ?? 'unsure'} disabled={!canEdit} onChange={(event) => update('crewCountBand', event.target.value as NonNullable<OnboardingProfile['crewCountBand']>)}>
                  <option value="unsure">Not sure</option><option value="solo">Just me</option><option value="2-5">2–5</option><option value="6-10">6–10</option><option value="11-25">11–25</option><option value="26+">26+</option>
                </select>
              </label>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <p className="text-sm text-slate-300">List the ZIP codes where you usually work. These are preferences, not a dispatch boundary.</p>
              {listField('Service ZIP codes', profile.serviceZipCodes, (value) => update('serviceZipCodes', value), 'Up to 20 five-digit ZIP codes.')}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              {listField('Roofing systems and materials', profile.roofingSystems, (value) => update('roofingSystems', value), 'Examples: architectural shingles, metal, tile, TPO.')}
              {listField('Related services', profile.relatedServices, (value) => update('relatedServices', value), 'Examples: gutters, siding, skylights.')}
              {listField('Lead sources', profile.leadSources, (value) => update('leadSources', value), 'Examples: referrals, website, canvassing, storm leads.')}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <label className={labelClass}>Inspection approach
                <select className={inputClass} value={profile.inspectionStyle ?? 'unsure'} disabled={!canEdit} onChange={(event) => update('inspectionStyle', event.target.value as NonNullable<OnboardingProfile['inspectionStyle']>)}>
                  <option value="unsure">Not sure</option><option value="manual">Manual inspection</option><option value="photo_first">Photo-first</option><option value="drone_assisted">Drone-assisted</option><option value="mixed">A mix of approaches</option>
                </select>
              </label>
              <label className={labelClass}>Estimate workflow
                <select className={inputClass} value={profile.estimateWorkflow ?? 'unsure'} disabled={!canEdit} onChange={(event) => update('estimateWorkflow', event.target.value as NonNullable<OnboardingProfile['estimateWorkflow']>)}>
                  <option value="unsure">Not sure</option><option value="owner_priced">Owner reviews pricing</option><option value="estimator_priced">Estimator prepares pricing</option><option value="external">Pricing handled externally</option>
                </select>
              </label>
              <label className={labelClass}>Production workflow
                <select className={inputClass} value={profile.productionWorkflow ?? 'unsure'} disabled={!canEdit} onChange={(event) => update('productionWorkflow', event.target.value as NonNullable<OnboardingProfile['productionWorkflow']>)}>
                  <option value="unsure">Not sure</option><option value="in_house">In-house crews</option><option value="subcontracted">Subcontractors</option><option value="mixed">A mix of both</option>
                </select>
              </label>
              <label className={labelClass}>Customer contact preferences
                <select className={inputClass} value={(profile.customerContactPreferences ?? ['unsure']).join(',')} disabled={!canEdit} onChange={(event) => update('customerContactPreferences', event.target.value.split(',') as NonNullable<OnboardingProfile['customerContactPreferences']>)}>
                  <option value="unsure">Not sure</option><option value="phone">Phone</option><option value="email">Email</option><option value="text">Text</option><option value="phone,email">Phone and email</option><option value="phone,text">Phone and text</option><option value="email,text">Email and text</option><option value="phone,email,text">All three</option>
                </select>
              </label>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <label className={labelClass}>What would you most like ROOF/OS to help improve first?
                <textarea className={inputClass + ' min-h-32 resize-y'} maxLength={240} value={profile.primaryGoal ?? ''} disabled={!canEdit} onChange={(event) => update('primaryGoal', event.target.value)} placeholder="Example: make the handoff from inspection to estimate easier." />
              </label>
              <p className="text-xs text-slate-400">Your answer is saved as a preference. It does not create jobs, change company policy, or activate any feature.</p>
            </div>
          )}

          <div className="mt-8 flex items-center justify-between gap-3 border-t border-white/10 pt-4">
            <button type="button" onClick={() => setStep((current) => Math.max(0, current - 1))} disabled={step === 0} className="rounded-lg border border-white/15 px-4 py-2 text-sm text-slate-200 disabled:opacity-30">Back</button>
            {step < STEPS.length - 1 ? (
              <button type="button" onClick={() => setStep((current) => Math.min(STEPS.length - 1, current + 1))} className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500">Next section</button>
            ) : (
              <div className="flex flex-wrap justify-end gap-2">
                <button type="button" onClick={() => void save('draft')} disabled={!canEdit || saving} className="rounded-lg border border-cyan-300/40 px-4 py-2 text-sm font-semibold text-cyan-100 disabled:opacity-40">{saving ? 'Saving…' : 'Save progress'}</button>
                <button type="button" onClick={() => void save('completed')} disabled={!canEdit || saving} className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500 disabled:opacity-40">Mark setup complete</button>
              </div>
            )}
          </div>
          {status === 'completed' && <p className="mt-4 text-xs text-emerald-300">This workspace profile is marked complete. You can still update it as an administrator.</p>}
          {error && <p className="mt-4 text-sm text-red-300" role="alert">{error}</p>}
          {notice && <p className="mt-4 text-sm text-emerald-300" role="status" aria-live="polite">{notice}</p>}
        </section>
      </div>
    </main>
  )
}
