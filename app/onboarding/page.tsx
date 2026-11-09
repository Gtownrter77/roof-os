'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase/client'
import HologramMeteorologist from '../../components/onboarding/HologramMeteorologist'

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({
    companyName: '',
    phone: '',
    email: '',
    state: 'GA',
    role: 'owner'
  })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [checkingAccess, setCheckingAccess] = useState(true)
  const [restoringAccountBasics, setRestoringAccountBasics] = useState(true)

  useEffect(() => {
    let active = true
    async function routeWorkspaceMembers() {
      try {
        const response = await fetch('/api/onboarding/profile', { cache: 'no-store' })
        if (!response.ok) return
        const data = await response.json()
        if (active && data.canEdit === false) router.replace('/onboarding/workspace')
      } catch {
        // If the profile endpoint is unavailable, leave the account form usable.
      } finally {
        if (active) setCheckingAccess(false)
      }
    }
    void routeWorkspaceMembers()
    return () => { active = false }
  }, [router])

  useEffect(() => {
    let active = true
    async function restoreAccountBasics() {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!active || !user) return
        const metadata = user.user_metadata ?? {}
        const metadataCompanyName = typeof metadata.company_name === 'string' ? metadata.company_name : ''
        if (metadataCompanyName) setForm((current) => ({ ...current, companyName: metadataCompanyName }))
        const { data: workspaceId, error: workspaceIdError } = await supabase.rpc('current_workspace_id')
        if (workspaceIdError) throw workspaceIdError
        if (workspaceId) {
          const { data: workspace, error: workspaceError } = await supabase.from('workspaces').select('name').eq('id', workspaceId).maybeSingle()
          if (workspaceError) throw workspaceError
          if (workspace?.name) setForm((current) => ({ ...current, companyName: workspace.name }))
        }
        const allowedStates = ['GA', 'AL', 'SC', 'NC', 'FL', 'TN']
        const allowedRoles = ['owner', 'manager', 'inspector', 'sales']
        setForm((current) => ({
          ...current,
          phone: typeof metadata.onboarding_phone === 'string' ? metadata.onboarding_phone : current.phone,
          email: typeof metadata.onboarding_contact_email === 'string' ? metadata.onboarding_contact_email : typeof user.email === 'string' ? user.email : current.email,
          state: typeof metadata.onboarding_state === 'string' && allowedStates.includes(metadata.onboarding_state) ? metadata.onboarding_state : current.state,
          role: typeof metadata.onboarding_role_preference === 'string' && allowedRoles.includes(metadata.onboarding_role_preference) ? metadata.onboarding_role_preference : current.role,
        }))
      } catch {
        if (active) setError('Saved account details could not be restored. You can enter them again here.')
      } finally {
        if (active) setRestoringAccountBasics(false)
      }
    }
    void restoreAccountBasics()
    return () => { active = false }
  }, [])

  const steps = [
    { 
      title: 'Welcome to ROOF/OS! 👋',
      description: 'Let\'s get your roofing company set up in minutes.',
      icon: '🚀'
    },
    { 
      title: 'Workspace & Contact Details 📋',
      description: 'Confirm your workspace name and add your contact details.',
      icon: '🏢'
    },
    { 
      title: 'Your Role 👤',
      description: 'Set up your account preferences.',
      icon: '⚙️'
    },
    { 
      title: 'Review and continue',
      description: 'Review your account basics, save them, and continue. Your workspace setup is next.',
      icon: '🎊'
    }
  ]

  const handleNext = async () => {
    if (step === 2 && form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      setError('Enter a valid contact email, or leave the field blank.')
      return
    }
    setError('')
    if (step < 4) {
      setStep(step + 1)
      return
    }

    setSaving(true)
    try {
      const supabase = createClient()
      const { error: updateError } = await supabase.auth.updateUser({
        data: {
          onboarding_contact_email: form.email.trim(),
          onboarding_phone: form.phone.trim(),
          onboarding_state: form.state,
          onboarding_role_preference: form.role,
          onboarding_basics_saved_at: new Date().toISOString(),
        },
      })
      if (updateError) {
        setError('Could not save your onboarding details. Nothing was marked complete.')
        return
      }
      router.push('/onboarding/workspace')
    } catch {
      setError('Could not save your onboarding details. Check your connection and try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1)
    }
  }

  const renderStep = () => {
    switch(step) {
      case 1:
        return (
          <div className="text-center">
            <div className="text-6xl mb-4">🚀</div>
            <h2 className="text-2xl font-bold mb-2">Welcome to ROOF/OS!</h2>
            <p className="text-slate-400">The all-in-one platform for roofing contractors.</p>
            <div className="mt-6 grid grid-cols-2 gap-3 text-left">
              <div className="bg-cyan-400/10 p-3 rounded-lg">
                <span className="text-2xl block">🌩️</span>
                <span className="text-sm font-medium">Storm Tracking</span>
              </div>
              <div className="bg-emerald-400/10 p-3 rounded-lg">
                <span className="text-2xl block">🤖</span>
                <span className="text-sm font-medium">AI Reports</span>
              </div>
              <div className="bg-purple-400/10 p-3 rounded-lg">
                <span className="text-2xl block">📷</span>
                <span className="text-sm font-medium">Camera</span>
              </div>
              <div className="bg-amber-400/10 p-3 rounded-lg">
                <span className="text-2xl block">📊</span>
                <span className="text-sm font-medium">Analytics</span>
              </div>
            </div>
            <button type="button" onClick={() => setStep(2)} className="mt-5 w-full rounded-lg border border-cyan-300/35 px-4 py-3 text-sm font-semibold text-cyan-100 hover:bg-cyan-300/10">
              Continue to company details
            </button>
          </div>
        )
      case 2:
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Workspace & Contact Details</h2>
            <div>
              <label htmlFor="onboarding-company-name" className="block text-sm font-medium text-slate-200 mb-1">Workspace Name</label>
              <input
                id="onboarding-company-name"
                type="text"
                autoComplete="organization"
                readOnly
                value={form.companyName}
                className="ops-input"
                placeholder="Workspace name not available"
                aria-describedby="onboarding-company-name-help"
              />
              <p id="onboarding-company-name-help" className="mt-1 text-xs text-slate-400">The active workspace record is authoritative. The original signup name is shown only as a fallback if the workspace cannot be read; onboarding never renames the workspace.</p>
            </div>
            <div>
              <label htmlFor="onboarding-company-phone" className="block text-sm font-medium text-slate-200 mb-1">Phone</label>
              <input 
                id="onboarding-company-phone"
                type="tel"
                autoComplete="tel"
                value={form.phone}
                onChange={(e) => setForm({...form, phone: e.target.value})}
                className="ops-input"
                placeholder="(555) 123-4567"
              />
            </div>
            <div>
              <label htmlFor="onboarding-contact-email" className="block text-sm font-medium text-slate-200 mb-1">Contact Email</label>
              <input 
                id="onboarding-contact-email"
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={(e) => setForm({...form, email: e.target.value})}
                className="ops-input"
                placeholder="you@company.com"
              />
            </div>
            <div>
              <label htmlFor="onboarding-company-state" className="block text-sm font-medium text-slate-200 mb-1">State</label>
              <select 
                id="onboarding-company-state"
                value={form.state}
                onChange={(e) => setForm({...form, state: e.target.value})}
                className="ops-input"
              >
                <option value="GA">Georgia</option>
                <option value="AL">Alabama</option>
                <option value="SC">South Carolina</option>
                <option value="NC">North Carolina</option>
                <option value="FL">Florida</option>
                <option value="TN">Tennessee</option>
              </select>
            </div>
          </div>
        )
      case 3:
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Your Role</h2>
            <p className="text-xs leading-relaxed text-slate-400">This records your preferred role for onboarding context only. It does not grant workspace permissions or change access; an administrator manages those separately.</p>
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setForm({...form, role: 'owner'})} aria-pressed={form.role === 'owner'} className={`p-4 border-2 rounded-lg text-center ${form.role === 'owner' ? 'border-blue-500 bg-cyan-400/10' : 'border-white/10'} focus-visible:outline-2 focus-visible:outline-cyan-200`}>
                <span className="text-2xl block">👔</span>
                <span className="text-sm font-medium">Owner</span>
              </button>
              <button type="button" onClick={() => setForm({...form, role: 'manager'})} aria-pressed={form.role === 'manager'} className={`p-4 border-2 rounded-lg text-center ${form.role === 'manager' ? 'border-blue-500 bg-cyan-400/10' : 'border-white/10'} focus-visible:outline-2 focus-visible:outline-cyan-200`}>
                <span className="text-2xl block">📋</span>
                <span className="text-sm font-medium">Manager</span>
              </button>
              <button type="button" onClick={() => setForm({...form, role: 'inspector'})} aria-pressed={form.role === 'inspector'} className={`p-4 border-2 rounded-lg text-center ${form.role === 'inspector' ? 'border-blue-500 bg-cyan-400/10' : 'border-white/10'} focus-visible:outline-2 focus-visible:outline-cyan-200`}>
                <span className="text-2xl block">🔍</span>
                <span className="text-sm font-medium">Inspector</span>
              </button>
              <button type="button" onClick={() => setForm({...form, role: 'sales'})} aria-pressed={form.role === 'sales'} className={`p-4 border-2 rounded-lg text-center ${form.role === 'sales' ? 'border-blue-500 bg-cyan-400/10' : 'border-white/10'} focus-visible:outline-2 focus-visible:outline-cyan-200`}>
                <span className="text-2xl block">📞</span>
                <span className="text-sm font-medium">Sales</span>
              </button>
            </div>
          </div>
        )
      case 4:
        return (
          <div className="text-center">
            <div className="text-6xl mb-4">🎊</div>
            <h2 className="text-2xl font-bold mb-2">Review your account basics</h2>
            <p className="text-slate-400">Review your account details. Continuing saves these basics and opens your resumable workspace setup. You can save workspace progress and return later.</p>
            <div className="mt-6 bg-cyan-400/10 border border-cyan-400/30 rounded-lg p-4">
              <p className="text-sm text-cyan-100">
                ✓ Company details entered<br />
                ✓ Account role selected<br />
                ⏭️ Save and continue to workspace setup
              </p>
            </div>
          </div>
        )
    }
  }

  if (checkingAccess || restoringAccountBasics) {
    return <main className="ops-bg flex min-h-screen items-center justify-center p-6 text-sm text-slate-300">Preparing your workspace details…</main>
  }

  return (
    <div className="ops-bg flex min-h-screen items-center justify-center p-4">
      <div className="glass rounded-2xl max-w-md w-full p-6">
        <HologramMeteorologist step={step} />
        {/* Progress */}
        <div className="flex justify-between mb-6">
          {steps.map((_, index) => {
            const i = index + 1
            return (
            <div key={i} className="flex-1">
              <div className={`h-1 mx-1 rounded ${i <= step ? 'bg-blue-600' : 'bg-white/10'}`} />
            </div>
            )
          })}
        </div>

        {/* Content */}
        <div className="min-h-[300px]">
          {renderStep()}
          {error && <p className="text-sm text-red-300 mt-4" role="alert">{error}</p>}
        </div>

        {/* Navigation */}
        <div className="flex justify-between mt-6">
          <button 
            type="button"
            onClick={handleBack}
            disabled={step === 1 || saving}
            className={`px-6 py-2 rounded-lg ${step > 1 ? 'bg-white/10 text-slate-200' : 'invisible'}`}
          >
            Back
          </button>
          <button 
            type="button"
            onClick={() => void handleNext()}
            disabled={saving}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold disabled:opacity-60"
          >
            {saving ? 'Saving…' : step === 4 ? 'Save and continue workspace setup' : 'Next →'}
          </button>
        </div>
      </div>
    </div>
  )
}
