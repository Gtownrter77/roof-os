'use client'

import { useCallback, useEffect, useState } from 'react'
import type { OnboardingProfile, OnboardingProfileStatus } from '../../../lib/onboarding-profile'
import WorkspaceOnboardingAssistant from '../../../components/WorkspaceOnboardingAssistant'
import WorkspaceSetupTour from '../../../components/onboarding/WorkspaceSetupTour'
import WorkspaceFirstSuccessGuide from '../../../components/onboarding/WorkspaceFirstSuccessGuide'
import { createClient } from '../../../lib/supabase/client'

const EMPTY_PROFILE: OnboardingProfile = {
  companyType: 'unsure',
  yearsInBusinessBand: 'unsure',
  serviceZipCodes: [],
  roofingSystems: [],
  relatedServices: [],
  crewCountBand: 'unsure',
  teamRoles: [],
  leadSources: [],
  inspectionStyle: 'unsure',
  photoEvidenceWorkflow: 'unsure',
  estimateWorkflow: 'unsure',
  approvalWorkflow: 'unsure',
  productionWorkflow: 'unsure',
  schedulingWorkflow: 'unsure',
  materialWorkflow: 'unsure',
  permitWorkflow: 'unsure',
  qualityControlWorkflow: 'unsure',
  closeoutWorkflow: 'unsure',
  warrantyWorkflow: 'unsure',
  customerContactPreferences: ['unsure'],
  businessHours: '',
  primaryGoal: '',
}

type RolePreference = 'owner' | 'manager' | 'inspector' | 'sales'

type WorkspaceDefaults = {
  default_language?: string
  default_zipcode?: string | null
  preferred_brands?: Record<string, string>
  material_search_mode?: 'catalog_only' | 'catalog_and_retailer'
}

const STEPS = ['Business', 'Service area', 'Work mix', 'Team', 'Sales & inspection', 'Operations', 'Communication', 'Goal']
type TeamRole = NonNullable<OnboardingProfile['teamRoles']>[number]
const TEAM_ROLE_OPTIONS: Array<{ value: TeamRole; label: string }> = [
  { value: 'owner', label: 'Owner' },
  { value: 'manager', label: 'Manager' },
  { value: 'sales', label: 'Sales' },
  { value: 'estimator', label: 'Estimator' },
  { value: 'project_manager', label: 'Project manager' },
  { value: 'inspector', label: 'Inspector' },
  { value: 'foreman', label: 'Foreman' },
  { value: 'installer', label: 'Installer' },
  { value: 'office', label: 'Office' },
  { value: 'other', label: 'Other' },
]

const PROFILE_FIELD_SECTIONS: Record<keyof OnboardingProfile, number> = {
  companyType: 0,
  yearsInBusinessBand: 0,
  serviceZipCodes: 1,
  roofingSystems: 2,
  relatedServices: 2,
  crewCountBand: 0,
  teamRoles: 3,
  leadSources: 2,
  inspectionStyle: 4,
  photoEvidenceWorkflow: 4,
  estimateWorkflow: 4,
  approvalWorkflow: 4,
  productionWorkflow: 5,
  schedulingWorkflow: 5,
  materialWorkflow: 5,
  permitWorkflow: 5,
  qualityControlWorkflow: 5,
  closeoutWorkflow: 5,
  warrantyWorkflow: 5,
  customerContactPreferences: 6,
  businessHours: 6,
  primaryGoal: 7,
}

function splitList(value: string) {
  return [...new Set(value.split(',').map((item) => item.trim()).filter(Boolean))]
}

function listValue(value: string[] | undefined) {
  return (value ?? []).join(', ')
}

export default function WorkspaceOnboardingPage() {
  const [profile, setProfile] = useState<OnboardingProfile>(EMPTY_PROFILE)
  const [savedProfile, setSavedProfile] = useState<OnboardingProfile>(EMPTY_PROFILE)
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const [status, setStatus] = useState<OnboardingProfileStatus>('draft')
  const [step, setStep] = useState(0)
  const [canEdit, setCanEdit] = useState(false)
  const [setupMode, setSetupMode] = useState<'choose' | 'assistant' | 'manual'>('choose')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [assistantBusy, setAssistantBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [workspaceDefaults, setWorkspaceDefaults] = useState<WorkspaceDefaults | null>(null)
  const [defaultsPersisted, setDefaultsPersisted] = useState(false)
  const [defaultsError, setDefaultsError] = useState('')
  const [rolePreference, setRolePreference] = useState<RolePreference>('owner')

  useEffect(() => {
    let active = true
    async function loadProfile() {
      try {
        const response = await fetch('/api/onboarding/profile', { cache: 'no-store' })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Could not load workspace setup.')
        if (!active) return
        const loadedProfile = { ...EMPTY_PROFILE, ...(data.profile ?? {}) }
        setProfile(loadedProfile)
        setSavedProfile(loadedProfile)
        setUpdatedAt(typeof data.updatedAt === 'string' ? data.updatedAt : null)
        setStatus(data.status === 'completed' ? 'completed' : 'draft')
        setCanEdit(data.canEdit === true)
        setSetupMode(data.canEdit === true ? 'choose' : 'manual')
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : 'Could not load workspace setup.')
      } finally {
        if (active) setLoading(false)
      }
    }
    void loadProfile()
    return () => { active = false }
  }, [])

  useEffect(() => {
    let active = true
    async function loadRolePreference() {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        const preference = user?.user_metadata?.onboarding_role_preference
        if (active && ['owner', 'manager', 'inspector', 'sales'].includes(preference)) {
          setRolePreference(preference as RolePreference)
        }
      } catch {
        // The tour falls back to the general owner/team route order.
      }
    }
    void loadRolePreference()
    return () => { active = false }
  }, [])

  useEffect(() => {
    let active = true
    async function loadWorkspaceDefaults() {
      try {
        const response = await fetch('/api/settings', { cache: 'no-store' })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Could not load workspace defaults.')
        if (!active) return
        setWorkspaceDefaults(data.settings ?? null)
        setDefaultsPersisted(data.persisted === true)
      } catch (cause) {
        if (active) setDefaultsError(cause instanceof Error ? cause.message : 'Could not load workspace defaults.')
      }
    }
    void loadWorkspaceDefaults()
    return () => { active = false }
  }, [])

  const selectTourSection = useCallback((section: number) => setStep(section), [])

  function focusProfileField(key: keyof OnboardingProfile) {
    setStep(PROFILE_FIELD_SECTIONS[key])
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    document.getElementById('step-heading')?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' })
  }
  const hasUnsavedChanges = JSON.stringify(profile) !== JSON.stringify(savedProfile)
  const hasBusinessType = ['residential', 'commercial', 'both'].includes(profile.companyType ?? 'unsure')
  const canComplete = hasBusinessType && Boolean(profile.primaryGoal?.trim())
  const savedEntries = Object.entries(savedProfile).filter(([, value]) => {
    if (Array.isArray(value)) return value.length > 0 && !value.every((item) => item === 'unsure')
    return value !== undefined && value !== null && value !== '' && value !== 'unsure'
  })

  function update<K extends keyof OnboardingProfile>(key: K, value: OnboardingProfile[K]) {
    setProfile((current) => ({ ...current, [key]: value }))
    setNotice('')
  }

  async function save(nextStatus: OnboardingProfileStatus) {
    if (!canEdit || saving || assistantBusy) return
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
      const persistedProfile = { ...EMPTY_PROFILE, ...(data.profile ?? profile) }
      setProfile(persistedProfile)
      setSavedProfile(persistedProfile)
      setUpdatedAt(typeof data.updated_at === 'string' ? data.updated_at : null)
      setStatus(data.status === 'completed' ? 'completed' : 'draft')
      setNotice(nextStatus === 'completed' ? 'Workspace setup marked complete.' : 'Progress saved. You can return and continue later.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save workspace setup.')
    } finally {
      setSaving(false)
    }
  }

  function resetProfileField(key: keyof OnboardingProfile) {
    const emptyValue: Partial<OnboardingProfile> = {
      serviceZipCodes: [], roofingSystems: [], relatedServices: [], teamRoles: [], leadSources: [],
      customerContactPreferences: ['unsure'], businessHours: '', primaryGoal: '',
      companyType: 'unsure', yearsInBusinessBand: 'unsure', crewCountBand: 'unsure',
      inspectionStyle: 'unsure', photoEvidenceWorkflow: 'unsure', estimateWorkflow: 'unsure',
      approvalWorkflow: 'unsure', productionWorkflow: 'unsure', schedulingWorkflow: 'unsure',
      materialWorkflow: 'unsure', permitWorkflow: 'unsure', qualityControlWorkflow: 'unsure',
      closeoutWorkflow: 'unsure', warrantyWorkflow: 'unsure',
    }
    if (!(key in emptyValue)) return
    setProfile((current) => ({ ...current, [key]: emptyValue[key] }))
    setNotice('Answer cleared in the form only. Choose Save progress to persist the change.')
  }

  const inputClass = 'mt-1 w-full rounded-xl border border-white/15 bg-slate-950/70 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400 disabled:opacity-60'
  const labelClass = 'block text-sm font-medium text-slate-200'
  const listField = (label: string, value: string[] | undefined, onChange: (next: string[]) => void, hint: string) => (
    <label className={labelClass}>
      {label}
      <input className={inputClass} value={listValue(value)} disabled={!canEdit || saving || assistantBusy} onChange={(event) => onChange(splitList(event.target.value))} placeholder="Separate entries with commas" />
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
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs" aria-live="polite">
            {updatedAt && <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-slate-300">Last saved {new Date(updatedAt).toLocaleString()}</span>}
            {hasUnsavedChanges && <span className="rounded-full border border-amber-300/30 bg-amber-950/25 px-3 py-1 text-amber-100">Unsaved changes</span>}
            {!hasUnsavedChanges && status === 'completed' && <span className="rounded-full border border-emerald-300/30 bg-emerald-950/25 px-3 py-1 text-emerald-100">Setup complete</span>}
          </div>
        </header>

        <div className="mb-5 rounded-xl border border-cyan-300/20 bg-cyan-950/25 p-3 text-xs leading-relaxed text-cyan-100/80">
          These are reviewed workspace preferences only. Saving them does not change pricing, permissions, crew assignments, customer records, integrations, or live operations. Optional local AI suggestions require owner review and never save automatically.
        </div>

        <details className="mb-5 rounded-xl border border-white/15 bg-slate-950/55 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-cyan-100">Review saved workspace preferences ({savedEntries.length})</summary>
          <div className="mt-3 space-y-3">
            <p className="text-xs text-slate-400">{updatedAt ? `Last saved ${new Date(updatedAt).toLocaleString()}` : 'No saved profile timestamp yet.'} These are the last values confirmed by the workspace profile API, not unsaved form edits. Each save records the actor, changed fields, source, confidence, and explicit unknowns in an append-only workspace audit record.</p>
            {savedEntries.length === 0 ? (
              <p className="text-xs text-slate-300">No saved preferences yet. Complete a section and choose Save progress when ready.</p>
            ) : (
              <div className="space-y-2">
                {savedEntries.map(([rawKey, value]) => {
                  const key = rawKey as keyof OnboardingProfile
                  const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, (letter) => letter.toUpperCase())
                  return (
                    <div key={key} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/15 p-3">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-white">{label}</p>
                        <p className="break-words text-xs text-slate-300">{Array.isArray(value) ? value.join(', ') : String(value)}</p>
                      </div>
                      {canEdit && (
                        <button type="button" onClick={() => resetProfileField(key)} disabled={saving || assistantBusy} className="shrink-0 rounded-lg border border-amber-200/25 px-2.5 py-1.5 text-[11px] font-semibold text-amber-100 disabled:opacity-40">Reset this answer</button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </details>
        <section className="mb-5 rounded-xl border border-white/15 bg-slate-950/55 p-4" aria-labelledby="workspace-defaults-heading">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 id="workspace-defaults-heading" className="text-sm font-semibold text-cyan-100">Existing workspace defaults</h2>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-200">Existing supported settings · read only</p>
              <p className="mt-1 text-xs text-slate-400">Read-only snapshot of settings already stored in ROOF/OS. This wizard does not duplicate or change them.</p>
            </div>
            {canEdit && <a href="/settings" className="rounded-lg border border-cyan-300/30 px-3 py-2 text-xs font-semibold text-cyan-100 hover:bg-cyan-300/10">Review in Settings</a>}
          </div>
          {defaultsError ? (
            <p className="mt-3 text-xs text-amber-200" role="status">{defaultsError} You can still finish the workspace profile.</p>
          ) : !workspaceDefaults ? (
            <p className="mt-3 text-xs text-slate-400" role="status">Loading existing defaults…</p>
          ) : (
            <>
              <dl className="mt-3 grid gap-3 text-xs sm:grid-cols-2">
                <div><dt className="text-slate-500">Language</dt><dd className="mt-1 font-medium text-slate-200">{workspaceDefaults.default_language || 'Not set'}</dd></div>
                <div><dt className="text-slate-500">Default service ZIP</dt><dd className="mt-1 font-medium text-slate-200">{workspaceDefaults.default_zipcode || 'Not set'}</dd></div>
                <div><dt className="text-slate-500">Preferred material brands</dt><dd className="mt-1 font-medium text-slate-200">{Object.entries(workspaceDefaults.preferred_brands ?? {}).map(([category, brand]) => `${category}: ${brand}`).join(' · ') || 'None saved'}</dd></div>
                <div><dt className="text-slate-500">Material search</dt><dd className="mt-1 font-medium text-slate-200">{workspaceDefaults.material_search_mode === 'catalog_only' ? 'Catalog only' : 'Catalog and retailer'}</dd></div>
              </dl>
              <p className="mt-3 text-[11px] text-slate-500">{defaultsPersisted ? 'Saved workspace settings.' : 'Showing system defaults; no workspace override has been saved yet.'} Changes remain in the existing Settings authorization flow.</p>
            </>
          )}
        </section>

        {canEdit && setupMode === 'choose' && (
          <section id="setup-mode-choice" className="mb-6 rounded-2xl border border-cyan-300/25 bg-slate-950/65 p-4" aria-labelledby="setup-mode-heading">
            <h2 id="setup-mode-heading" className="text-lg font-semibold text-white">How would you like to build your setup?</h2>
            <p className="mt-1 text-sm text-slate-400">Both paths lead to the same reviewed workspace profile. The assistant is optional.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <button type="button" onClick={() => setSetupMode('assistant')} className="rounded-xl border border-cyan-300/40 bg-cyan-950/30 p-4 text-left hover:bg-cyan-900/40">
                <span className="block text-sm font-semibold text-cyan-100">Build my setup with the assistant</span>
                <span className="mt-1 block text-xs leading-relaxed text-slate-300">Describe your business naturally. Review any suggested profile details before applying them.</span>
              </button>
              <button type="button" onClick={() => setSetupMode('manual')} className="rounded-xl border border-white/20 bg-white/5 p-4 text-left hover:bg-white/10">
                <span className="block text-sm font-semibold text-white">I’ll configure it myself</span>
                <span className="mt-1 block text-xs leading-relaxed text-slate-300">Go straight to the eight guided sections. No AI conversation is needed.</span>
              </button>
            </div>
          </section>
        )}

        {canEdit && setupMode === 'assistant' && (
          <>
            <WorkspaceOnboardingAssistant
              profile={profile}
              savedSnapshot={savedProfile}
              busy={saving}
              onBusyChange={setAssistantBusy}
              onEditField={focusProfileField}
              onApply={(nextProfile) => {
                setProfile(nextProfile)
                setNotice('Assistant suggestion applied to the form. Review it, then save when ready.')
              }}
            />
            <button type="button" onClick={() => setSetupMode('manual')} className="mb-5 rounded-lg border border-white/15 px-3 py-2 text-xs text-slate-300 hover:bg-white/5">Switch to manual setup</button>
          </>
        )}

        {canEdit && setupMode === 'manual' && (
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-950/45 p-3">
            <p className="text-xs text-slate-300">Manual setup selected. The assistant is optional and can be opened at any time.</p>
            <button type="button" onClick={() => setSetupMode('assistant')} className="rounded-lg border border-cyan-300/35 px-3 py-2 text-xs font-semibold text-cyan-100">Use assistant</button>
          </div>
        )}

        {canEdit && setupMode !== 'choose' && (
          <WorkspaceSetupTour key={setupMode} assistantEnabled={setupMode === 'assistant'} onSelectSection={selectTourSection} />
        )}

        {!canEdit && (
          <div className="mb-5 rounded-xl border border-amber-300/30 bg-amber-950/25 p-3 text-sm text-amber-100" role="status">
            You can review this workspace profile, but only a workspace administrator can change it.
          </div>
        )}

        {canEdit && setupMode !== 'choose' && (
          <>
        <nav aria-label="Workspace setup steps" className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
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
                <select className={inputClass} value={profile.companyType ?? 'unsure'} disabled={!canEdit || saving || assistantBusy} onChange={(event) => update('companyType', event.target.value as NonNullable<OnboardingProfile['companyType']>)}>
                  <option value="unsure">Not sure yet</option><option value="residential">Residential</option><option value="commercial">Commercial</option><option value="both">Both</option>
                </select>
              </label>
              <label className={labelClass}>Years in business (optional)
                <select className={inputClass} value={profile.yearsInBusinessBand ?? 'unsure'} disabled={!canEdit || saving || assistantBusy} onChange={(event) => update('yearsInBusinessBand', event.target.value as NonNullable<OnboardingProfile['yearsInBusinessBand']>)}>
                  <option value="unsure">Prefer not to say / not sure</option><option value="0-1">Less than 2 years</option><option value="2-5">2–5 years</option><option value="6-10">6–10 years</option><option value="11-20">11–20 years</option><option value="20+">More than 20 years</option>
                </select>
              </label>
              <label className={labelClass}>Approximate crew size
                <select className={inputClass} value={profile.crewCountBand ?? 'unsure'} disabled={!canEdit || saving || assistantBusy} onChange={(event) => update('crewCountBand', event.target.value as NonNullable<OnboardingProfile['crewCountBand']>)}>
                  <option value="unsure">Not sure</option><option value="solo">Just me</option><option value="2-5">2–5</option><option value="6-10">6–10</option><option value="11-25">11–25</option><option value="26+">26+</option>
                </select>
              </label>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <p className="text-sm text-slate-300">List the ZIP codes where you usually work. These are coverage preferences, not a dispatch boundary; the single default service ZIP remains in Workspace Settings.</p>
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
            <fieldset className="space-y-4">
              <legend className="text-sm text-slate-300">Which roles does your company use? Select all that apply. Do not enter employee names or personal details.</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                {TEAM_ROLE_OPTIONS.map(({ value, label }) => (
                  <label key={value} className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-slate-200">
                    <input
                      type="checkbox"
                      checked={(profile.teamRoles ?? []).includes(value)}
                      disabled={!canEdit || saving || assistantBusy}
                      onChange={(event) => {
                        const current = profile.teamRoles ?? []
                        update('teamRoles', event.target.checked
                          ? [...current, value]
                          : current.filter((role) => role !== value))
                      }}
                      className="h-4 w-4 accent-cyan-400"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <label className={labelClass}>Inspection approach
                <select className={inputClass} value={profile.inspectionStyle ?? 'unsure'} disabled={!canEdit || saving || assistantBusy} onChange={(event) => update('inspectionStyle', event.target.value as NonNullable<OnboardingProfile['inspectionStyle']>)}>
                  <option value="unsure">Not sure</option><option value="manual">Manual inspection</option><option value="photo_first">Photo-first</option><option value="drone_assisted">Drone-assisted</option><option value="mixed">A mix of approaches</option>
                </select>
              </label>
              <label className={labelClass}>Photo and evidence workflow
                <select className={inputClass} value={profile.photoEvidenceWorkflow ?? 'unsure'} disabled={!canEdit || saving || assistantBusy} onChange={(event) => update('photoEvidenceWorkflow', event.target.value as NonNullable<OnboardingProfile['photoEvidenceWorkflow']>)}>
                  <option value="unsure">Not sure</option><option value="phone_photos">Phone photos</option><option value="drone_photos">Drone photos</option><option value="mixed">Phone and drone photos</option>
                </select>
              </label>
              <label className={labelClass}>Estimate workflow
                <select className={inputClass} value={profile.estimateWorkflow ?? 'unsure'} disabled={!canEdit || saving || assistantBusy} onChange={(event) => update('estimateWorkflow', event.target.value as NonNullable<OnboardingProfile['estimateWorkflow']>)}>
                  <option value="unsure">Not sure</option><option value="owner_priced">Owner reviews pricing</option><option value="estimator_priced">Estimator prepares pricing</option><option value="external">Pricing handled externally</option>
                </select>
              </label>
              <label className={labelClass}>Estimate approval workflow
                <select className={inputClass} value={profile.approvalWorkflow ?? 'unsure'} disabled={!canEdit || saving || assistantBusy} onChange={(event) => update('approvalWorkflow', event.target.value as NonNullable<OnboardingProfile['approvalWorkflow']>)}>
                  <option value="unsure">Not sure</option><option value="owner_approval">Owner approval</option><option value="manager_approval">Manager approval</option><option value="external">Approval handled externally</option>
                </select>
              </label>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4">
              <label className={labelClass}>Production workflow
                <select className={inputClass} value={profile.productionWorkflow ?? 'unsure'} disabled={!canEdit || saving || assistantBusy} onChange={(event) => update('productionWorkflow', event.target.value as NonNullable<OnboardingProfile['productionWorkflow']>)}>
                  <option value="unsure">Not sure</option><option value="in_house">In-house crews</option><option value="subcontracted">Subcontractors</option><option value="mixed">A mix of both</option>
                </select>
              </label>
              <label className={labelClass}>Scheduling workflow
                <select className={inputClass} value={profile.schedulingWorkflow ?? 'unsure'} disabled={!canEdit || saving || assistantBusy} onChange={(event) => update('schedulingWorkflow', event.target.value as NonNullable<OnboardingProfile['schedulingWorkflow']>)}>
                  <option value="unsure">Not sure</option><option value="calendar">Calendar</option><option value="spreadsheet">Spreadsheet</option><option value="software">Other software</option><option value="manual">Manual coordination</option>
                </select>
              </label>
              <label className={labelClass}>Materials workflow
                <select className={inputClass} value={profile.materialWorkflow ?? 'unsure'} disabled={!canEdit || saving || assistantBusy} onChange={(event) => update('materialWorkflow', event.target.value as NonNullable<OnboardingProfile['materialWorkflow']>)}>
                  <option value="unsure">Not sure</option><option value="owner_ordered">Owner orders materials</option><option value="crew_pickup">Crew pickup</option><option value="supplier_delivery">Supplier delivery</option><option value="mixed">A mix of methods</option>
                </select>
              </label>
              <label className={labelClass}>Permit workflow
                <select className={inputClass} value={profile.permitWorkflow ?? 'unsure'} disabled={!canEdit || saving || assistantBusy} onChange={(event) => update('permitWorkflow', event.target.value as NonNullable<OnboardingProfile['permitWorkflow']>)}>
                  <option value="unsure">Not sure</option><option value="in_house">Handled in-house</option><option value="subcontracted">Handled by another party</option><option value="not_applicable">Not applicable to our work</option>
                </select>
              </label>
              <label className={labelClass}>Quality control
                <select className={inputClass} value={profile.qualityControlWorkflow ?? 'unsure'} disabled={!canEdit || saving || assistantBusy} onChange={(event) => update('qualityControlWorkflow', event.target.value as NonNullable<OnboardingProfile['qualityControlWorkflow']>)}>
                  <option value="unsure">Not sure</option><option value="checklist">Checklist</option><option value="manager_walkthrough">Manager walkthrough</option><option value="photo_review">Photo review</option><option value="mixed">A mix of methods</option>
                </select>
              </label>
              <label className={labelClass}>Job closeout
                <select className={inputClass} value={profile.closeoutWorkflow ?? 'unsure'} disabled={!canEdit || saving || assistantBusy} onChange={(event) => update('closeoutWorkflow', event.target.value as NonNullable<OnboardingProfile['closeoutWorkflow']>)}>
                  <option value="unsure">Not sure</option><option value="owner_review">Owner review</option><option value="office_review">Office review</option><option value="mixed">A mix of both</option>
                </select>
              </label>
              <label className={labelClass}>Warranty handling
                <select className={inputClass} value={profile.warrantyWorkflow ?? 'unsure'} disabled={!canEdit || saving || assistantBusy} onChange={(event) => update('warrantyWorkflow', event.target.value as NonNullable<OnboardingProfile['warrantyWorkflow']>)}>
                  <option value="unsure">Not sure</option><option value="manufacturer">Manufacturer warranty</option><option value="company">Company warranty</option><option value="both">Both</option>
                </select>
              </label>
            </div>
          )}

          {step === 6 && (
            <div className="space-y-4">
              <label className={labelClass}>Customer contact preferences
                <select className={inputClass} value={(profile.customerContactPreferences ?? ['unsure']).join(',')} disabled={!canEdit || saving || assistantBusy} onChange={(event) => update('customerContactPreferences', event.target.value.split(',') as NonNullable<OnboardingProfile['customerContactPreferences']>)}>
                  <option value="unsure">Not sure</option><option value="phone">Phone</option><option value="email">Email</option><option value="text">Text</option><option value="phone,email">Phone and email</option><option value="phone,text">Phone and text</option><option value="email,text">Email and text</option><option value="phone,email,text">All three</option>
                </select>
              </label>
              <label className={labelClass}>Business hours (optional)
                <input className={inputClass} maxLength={80} value={profile.businessHours ?? ''} disabled={!canEdit || saving || assistantBusy} onChange={(event) => update('businessHours', event.target.value)} placeholder="Example: Monday-Friday, 8 AM-5 PM" />
              </label>
              <p className="text-xs text-slate-400">These are communication preferences only. ROOF/OS will not send messages or activate an outside provider.</p>
            </div>
          )}

          {step === 7 && (
            <div className="space-y-4">
              <label className={labelClass}>What would you most like ROOF/OS to help improve first?
                <textarea className={inputClass + ' min-h-32 resize-y'} maxLength={240} value={profile.primaryGoal ?? ''} disabled={!canEdit || saving || assistantBusy} onChange={(event) => update('primaryGoal', event.target.value)} placeholder="Example: make the handoff from inspection to estimate easier." />
              </label>
              <p className="text-xs text-slate-400">Your answer is saved as a preference. It does not create jobs, change company policy, or activate any feature.</p>
            </div>
          )}

          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
            <button type="button" onClick={() => setStep((current) => Math.max(0, current - 1))} disabled={step === 0} className="rounded-lg border border-white/15 px-4 py-2 text-sm text-slate-200 disabled:opacity-30">Back</button>
            <div className="flex flex-wrap justify-end gap-2">
              <button id="workspace-save-progress" type="button" onClick={() => void save('draft')} disabled={!canEdit || saving || assistantBusy || !hasUnsavedChanges} className="rounded-lg border border-cyan-300/40 px-4 py-2 text-sm font-semibold text-cyan-100 disabled:opacity-40">{saving ? 'Saving…' : 'Save progress'}</button>
              {step < STEPS.length - 1 ? (
                <button type="button" onClick={() => setStep((current) => Math.min(STEPS.length - 1, current + 1))} className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500">Next section</button>
              ) : (
                <button type="button" onClick={() => void save('completed')} disabled={!canEdit || saving || assistantBusy || !canComplete} title={!canComplete ? 'Choose a business type other than “Not sure” and add your first goal before completing setup.' : undefined} className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500 disabled:opacity-40">Mark setup complete</button>
              )}
            </div>
          </div>
          {step === 7 && !canComplete && <p className="mt-3 text-xs text-amber-200" role="status">{!hasBusinessType ? 'Choose Residential, Commercial, or Both in the Business section.' : 'Add your first goal above.'} You can still save a draft at any time.</p>}
          {status === 'completed' && hasUnsavedChanges && <p className="mt-4 text-xs text-amber-200" role="status">The saved profile is complete, but you have unsaved edits. Save progress to return it to draft status, or complete it again after reviewing your changes.</p>}
          {status === 'completed' && !hasUnsavedChanges && <p className="mt-4 text-xs text-emerald-300">This workspace profile is marked complete. You can still update it as an administrator.</p>}
          
          {error && <p className="mt-4 text-sm text-red-300" role="alert">{error}</p>}
          {notice && <p className="mt-4 text-sm text-emerald-300" role="status" aria-live="polite">{notice}</p>}
        </section>
          </>
        )}
        {!canEdit && (
          <section className="rounded-2xl border border-violet-300/25 bg-violet-950/20 p-5" aria-labelledby="team-orientation-heading">
            <h2 id="team-orientation-heading" className="text-lg font-semibold text-violet-100">You’re joining an existing workspace</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">Workspace-level company setup is managed by an administrator. You do not need to complete the owner profile. You can review saved preferences above and use this short orientation to find the work areas available to your role.</p>
            <WorkspaceFirstSuccessGuide canEdit={false} primaryGoal={savedProfile.primaryGoal} rolePreference={rolePreference} />
          </section>
        )}
        {canEdit && status === 'completed' && !hasUnsavedChanges && <WorkspaceFirstSuccessGuide canEdit={true} primaryGoal={savedProfile.primaryGoal} rolePreference={rolePreference} />}
      </div>
    </main>
  )
}
