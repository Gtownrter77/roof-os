'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '../lib/supabase/client'

type Workspace = { id: string; name: string }
type MembershipRow = { workspace_id: string; workspaces: Workspace | Workspace[] | null }

const HIDDEN_ON = ['/auth/login', '/auth/signup', '/onboarding']

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

  useEffect(() => {
    let cancelled = false

    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || cancelled) return

      const [{ data: memberships }, { data: active }] = await Promise.all([
        supabase.from('workspace_members').select('workspace_id, workspaces(id, name)').eq('user_id', user.id).order('created_at'),
        supabase.from('user_active_workspaces').select('workspace_id').eq('user_id', user.id).maybeSingle(),
      ])
      if (cancelled) return

      const available = ((memberships ?? []) as MembershipRow[])
        .map(workspaceFromMembership)
        .filter((workspace): workspace is Workspace => Boolean(workspace))
      setWorkspaces(available)
      setActiveWorkspaceId(active?.workspace_id ?? available[0]?.id ?? '')
    }

    void load()
    return () => { cancelled = true }
  }, [])

  if (HIDDEN_ON.some((path) => pathname?.startsWith(path)) || workspaces.length < 2) return null

  async function chooseWorkspace(workspaceId: string) {
    if (!workspaceId || workspaceId === activeWorkspaceId) return
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setSaving(false)
      return
    }

    const { error } = await supabase
      .from('user_active_workspaces')
      .upsert({ user_id: user.id, workspace_id: workspaceId, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })

    if (!error) {
      setActiveWorkspaceId(workspaceId)
      router.refresh()
    }
    setSaving(false)
  }

  return (
    <div className="mx-auto flex max-w-6xl items-center justify-end px-4 pt-3">
      <label className="text-xs text-gray-500" htmlFor="active-workspace">
        Workspace
        <select
          id="active-workspace"
          value={activeWorkspaceId}
          disabled={saving}
          onChange={(event) => void chooseWorkspace(event.target.value)}
          className="ml-2 rounded border border-gray-300 bg-white px-2 py-1 text-sm text-gray-800 disabled:opacity-60"
        >
          {workspaces.map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.name}</option>)}
        </select>
      </label>
    </div>
  )
}
