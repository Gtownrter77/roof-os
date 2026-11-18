'use client'

import { useEffect, useMemo, useState } from 'react'

type AuthorityLevel = 'read' | 'prepare' | 'approve' | 'execute' | 'coordinate' | 'sustain' | 'release'
type Profile = {
  id?: string
  role_key: string
  authority_level: AuthorityLevel
  capabilities: string[]
  active: boolean
}

const ROLE_KEYS = ['owner', 'admin', 'operations', 'inspector', 'closer', 'canvasser', 'production', 'member']
const LEVELS: AuthorityLevel[] = ['read', 'prepare', 'approve', 'execute', 'coordinate', 'sustain', 'release']
const DEFAULT_CAPABILITIES: Record<string, string[]> = {
  owner: ['prepare', 'approve', 'execute', 'coordinate', 'sustain', 'release'],
  admin: ['prepare', 'approve', 'coordinate'],
  operations: ['prepare'],
  inspector: ['prepare'],
  closer: ['prepare'],
  canvasser: ['prepare'],
  production: ['prepare'],
  member: ['read'],
}

function initialProfile(role_key: string): Profile {
  const capabilities = DEFAULT_CAPABILITIES[role_key] ?? ['read']
  return { role_key, authority_level: capabilities.includes('release') ? 'release' : capabilities.includes('approve') ? 'approve' : capabilities.includes('prepare') ? 'prepare' : 'read', capabilities, active: true }
}

export default function ContractorAuthorityProfiles() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [canEdit, setCanEdit] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const byRole = useMemo(() => new Map(profiles.map(profile => [profile.role_key, profile])), [profiles])

  useEffect(() => {
    fetch('/api/contractor-os/authority-profiles').then(async response => {
      const payload = await response.json().catch(() => ({}))
      if (response.ok) {
        setProfiles((payload.profiles ?? []).map((profile: Profile) => ({ ...profile, capabilities: Array.isArray(profile.capabilities) ? profile.capabilities : [] })))
        setCanEdit(payload.canEdit === true)
      } else setMessage(payload.error ?? 'Could not load authority profiles.')
      setLoaded(true)
    }).catch(() => {
      setLoaded(true)
      setMessage('Could not load authority profiles.')
    })
  }, [])

  const ensureProfile = (roleKey: string) => byRole.get(roleKey) ?? initialProfile(roleKey)
  const update = (roleKey: string, patch: Partial<Profile>) => {
    setProfiles(current => {
      const existing = current.find(profile => profile.role_key === roleKey) ?? initialProfile(roleKey)
      const next = { ...existing, ...patch }
      return [...current.filter(profile => profile.role_key !== roleKey), next].sort((a, b) => ROLE_KEYS.indexOf(a.role_key) - ROLE_KEYS.indexOf(b.role_key))
    })
  }

  const save = async () => {
    if (!canEdit || saving) return
    setSaving(true)
    setMessage('Saving authority profiles…')
    try {
      const response = await fetch('/api/contractor-os/authority-profiles', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ profiles: ROLE_KEYS.map(roleKey => ensureProfile(roleKey)).map(profile => ({ roleKey: profile.role_key, authorityLevel: profile.authority_level, capabilities: profile.capabilities, active: profile.active })) }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        setMessage(payload.error ?? 'Authority profiles could not be saved.')
        return
      }
      setProfiles(payload.profiles ?? [])
      setMessage('Authority profiles saved. New approvals use these rules.')
    } catch {
      setMessage('Authority profiles could not be saved because the network request failed.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="glass rounded-xl p-4 border-l-4 border-cyan-500 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-bold text-sm text-white">ContractorOS authority profiles</h2>
          <p className="text-xs text-slate-400 mt-1">Approval authority is evaluated at approval time. Released actions still require the existing exact-payload approval gate.</p>
        </div>
        {canEdit && <button onClick={() => void save()} disabled={!loaded || saving} className="rounded-lg bg-cyan-400 px-3 py-2 text-xs font-bold text-slate-950 disabled:opacity-50">{saving ? 'Saving…' : 'Save profiles'}</button>}
      </div>
      <div className="space-y-2">
        {ROLE_KEYS.map(roleKey => {
          const profile = ensureProfile(roleKey)
          return (
            <div key={roleKey} className="grid grid-cols-[1fr_auto_auto] items-center gap-2 rounded-lg border border-white/10 bg-black/10 p-2">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-200">{roleKey}</div>
                <div className="text-[11px] text-slate-500">Capabilities: {profile.capabilities.length ? profile.capabilities.join(', ') : 'none'}</div>
              </div>
              <select aria-label={`${roleKey} authority level`} disabled={!canEdit} value={profile.authority_level} onChange={event => update(roleKey, { authority_level: event.target.value as AuthorityLevel })} className="rounded border border-white/10 bg-slate-900 px-2 py-1 text-xs text-white">
                {LEVELS.map(level => <option key={level} value={level}>{level}</option>)}
              </select>
              <label className="flex items-center gap-1 text-[11px] text-slate-400">
                <input type="checkbox" disabled={!canEdit} checked={profile.active} onChange={event => update(roleKey, { active: event.target.checked })} /> active
              </label>
            </div>
          )
        })}
      </div>
      {message && <p className="text-xs text-cyan-200" role="status">{message}</p>}
    </section>
  )
}
