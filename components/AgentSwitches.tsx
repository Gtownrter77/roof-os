'use client'

import { useEffect, useState } from 'react'
import type { AgentToggleState } from '../lib/agents/agent-toggles'

// Per-workspace agent switches (automation_rules). Each switch saves on its own; only the
// system owner can write, so everyone else sees a read-only state with the reason.
export default function AgentSwitches() {
  const [agents, setAgents] = useState<AgentToggleState[]>([])
  const [canEdit, setCanEdit] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [ownerEmailConfirm, setOwnerEmailConfirm] = useState('')
  const [ownerPhraseConfirm, setOwnerPhraseConfirm] = useState('')

  useEffect(() => {
    fetch('/api/settings/agents')
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) { setMessage(payload.error ?? 'Could not load agent switches.'); return }
        setAgents(payload.agents ?? [])
        setCanEdit(payload.canEdit === true)
      })
      .catch(() => setMessage('Could not load agent switches.'))
  }, [])

  const toggle = async (agent: AgentToggleState) => {
    if (!canEdit || busy || agent.enabled === null) return
    const enabled = !agent.enabled
    setBusy(agent.agentKey)
    setMessage('')
    try {
      const response = await fetch('/api/settings/agents', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ agent_key: agent.agentKey, enabled, ownerAuthorization: { email: ownerEmailConfirm, confirmation: ownerPhraseConfirm } }) })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) { setMessage(payload.error ?? 'Agent switch save failed.'); return }
      setAgents((current) => current.map((item) => item.agentKey === agent.agentKey ? { ...item, enabled } : item))
      setMessage(`${agent.label} ${enabled ? 'on' : 'off'}.`)
    } catch {
      setMessage('Agent switch save failed because the network request failed.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="glass rounded-xl p-4 border-l-4 border-violet-500 space-y-3" aria-labelledby="agent-switches-title">
      <h2 id="agent-switches-title" className="font-bold text-sm text-white">Workspace agents</h2>
      <p className="text-xs text-slate-400">
        Turns each background agent on or off for this workspace. Saved right away. {canEdit ? 'Owner 2-part authorization is required.' : 'Only the system owner can change these.'}
      </p>
      {canEdit && (
        <div className="space-y-2">
          <input value={ownerEmailConfirm} onChange={(e) => setOwnerEmailConfirm(e.target.value)} className="ops-input" placeholder="Part 1 · owner email" />
          <input value={ownerPhraseConfirm} onChange={(e) => setOwnerPhraseConfirm(e.target.value)} className="ops-input" placeholder="Part 2 · AUTHORIZE SETTINGS" />
        </div>
      )}
      <div className="space-y-2 text-xs">
        {agents.map((agent) => (
          <div key={agent.agentKey} className="flex justify-between items-start p-2 border rounded bg-white/5 gap-3">
            <div className="pr-2">
              <p className="font-bold text-white">{agent.label}</p>
              <p className="text-[10px] text-slate-400">{agent.desc}</p>
              {agent.enabled === null && <p className="text-[10px] text-amber-200 mt-1">Not set up in this workspace yet.</p>}
              {agent.settingsFlag && <p className="text-[10px] text-slate-500 mt-1">Also needs the matching toggle above.</p>}
            </div>
            <button
              type="button"
              onClick={() => toggle(agent)}
              disabled={!canEdit || busy !== null || agent.enabled === null || !ownerEmailConfirm.trim() || ownerPhraseConfirm.trim() !== 'AUTHORIZE SETTINGS'}
              aria-pressed={agent.enabled === true}
              aria-label={agent.label}
              className={`w-11 h-6 shrink-0 flex items-center rounded-full p-1 transition-colors disabled:opacity-50 ${agent.enabled ? 'bg-emerald-600' : 'bg-slate-600'}`}
            >
              <div className={`w-4 h-4 bg-white rounded-full shadow transform transition-transform ${agent.enabled ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>
        ))}
      </div>
      {message && <p className="text-xs text-slate-300" role="status">{message}</p>}
    </section>
  )
}
