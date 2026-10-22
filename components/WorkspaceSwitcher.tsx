'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '../lib/supabase/client'

type Workspace = { id: string; name: string }
type MembershipRow = { workspace_id: string; workspaces: Workspace | Workspace[] | null }

const HIDDEN_ON = ['/auth/login', '/auth/signup', '/auth/enter', '/onboarding']

function workspaceFromMembership(membership: MembershipRow): Workspace | null {
  if (Array.isArray(membership.workspaces)) return membership.workspaces[0] ?? null
  return membership.workspaces
}

export default function WorkspaceSwitcher() {
  const pathname = usePathname()
  const router = useRouter()
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [activeWorkspaceId, setActiveWorkspaceId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function load() {
      const supabase = createClient()
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (cancelled) return
      if (userError) { setError('Could not load the signed-in user.'); return }
      if (!user) return

      const [{ data: memberships, error: membershipError }, { data: active, error: activeError }] = await Promise.all([
        supabase.from('workspace_members').select('workspace_id, workspaces(id, name)').eq('user_id', user.id).order('created_at'),
        supabase.from('user_active_workspaces').select('workspace_id').eq('user_id', user.id).maybeSingle(),
      ])
      if (cancelled) return
      if (membershipError || activeError) { setError(membershipError?.message ?? activeError?.message ?? 'Could not load workspaces.'); return }

      const available = ((memberships ?? []) as MembershipRow[])
        .map(workspaceFromMembership)
        .filter((workspace): workspace is Workspace => Boolean(workspace))
      setWorkspaces(available)
      const activeId = active?.workspace_id
      const selectedId = activeId && available.some((workspace) => workspace.id === activeId)
        ? activeId
        : available[0]?.id ?? ''
      setActiveWorkspaceId(selectedId)
    }

    void load()
    return () => { cancelled = true }
  }, [])

  if (HIDDEN_ON.some((path) => pathname?.startsWith(path)) || workspaces.length < 2) return null

  async function chooseWorkspace(workspaceId: string) {
    if (!workspaceId || workspaceId === activeWorkspaceId) return
    if (!workspaces.some((workspace) => workspace.id === workspaceId)) { setError('That workspace is not available to your account.'); return }
    setError('')
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setError('You must be signed in to switch workspaces.')
      setSaving(false)
      return
    }

    const { error } = await supabase
      .from('user_active_workspaces')
      .upsert({ user_id: user.id, workspace_id: workspaceId, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })

    if (error) {
      setError(error.message)
    } else {
      setActiveWorkspaceId(workspaceId)
      router.refresh()
    }
    setSaving(false)
  }

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col items-end px-4 pt-3 md:px-6">
      {error && <p className="mb-2 text-xs text-red-300" role="alert">{error}</p>}
      <label className="text-xs text-slate-400" htmlFor="active-workspace">
        Workspace
        <select
          id="active-workspace"
          value={activeWorkspaceId}
          disabled={saving}
          onChange={(event) => void chooseWorkspace(event.target.value)}
          className="ml-2 rounded border border-white/15 bg-[#0a1427] px-2 py-1 text-sm text-white disabled:opacity-60"
        >
          {workspaces.map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.name}</option>)}
        </select>
      </label>
    </div>
  )
}