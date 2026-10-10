'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase/client'

type Profile = {
  name: string
  email: string
  role: string
  phone: string
  company: string
}

export default function ProfilePage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [profile, setProfile] = useState<Profile | null>(null)
  const [error, setError] = useState('')
  const [loggingOut, setLoggingOut] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function loadProfile() {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (cancelled) return
      if (userError || !user) {
        router.replace('/auth/enter')
        return
      }

      const [{ data: memberships }, { data: activeWorkspace }] = await Promise.all([
        supabase.from('workspace_members').select('role, workspace_id, workspaces(name)').eq('user_id', user.id).order('created_at').limit(1),
        supabase.from('user_active_workspaces').select('workspace_id').eq('user_id', user.id).maybeSingle(),
      ])

      const activeId = activeWorkspace?.workspace_id
      const activeMembership = activeId
        ? (memberships || []).find((item) => item.workspace_id === activeId)
        : memberships?.[0]

      const metadata = user.user_metadata || {}
      setProfile({
        name: String(metadata.full_name || metadata.name || user.email || 'User'),
        email: user.email || '',
        role: String(activeMembership?.role || 'member').replace(/^./, (value) => value.toUpperCase()),
        phone: String(metadata.phone || 'Not provided'),
        company: String(
          activeMembership?.workspaces && typeof activeMembership.workspaces === 'object' && 'name' in activeMembership.workspaces
            ? activeMembership.workspaces.name
            : metadata.company_name || 'Workspace'
        ),
      })
    }

    void loadProfile().catch(() => {
      if (!cancelled) setError('Unable to load your profile.')
    })

    return () => {
      cancelled = true
    }
  }, [router, supabase])

  async function logout() {
    setLoggingOut(true)
    const { error: signOutError } = await supabase.auth.signOut()
    if (signOutError) {
      setError('Unable to sign out. Please try again.')
      setLoggingOut(false)
      return
    }
    router.replace('/auth/enter')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-blue-600 text-white shadow-lg sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center">
          <button onClick={() => router.back()} className="text-white mr-3 text-xl" aria-label="Go back">←</button>
          <h1 className="text-xl font-bold">Profile</h1>
        </div>
      </header>

      <main className="p-4">
        {error && <p className="text-sm text-red-600 mb-4" role="alert">{error}</p>}

        {!profile ? (
          <div className="bg-white rounded-lg shadow p-6 text-sm text-gray-600">Loading profile…</div>
        ) : (
          <>
            <div className="bg-white rounded-lg shadow p-6 text-center">
              <div className="text-6xl mb-2" aria-hidden="true">👤</div>
              <h2 className="text-xl font-bold">{profile.name}</h2>
              <p className="text-sm text-gray-500">{profile.role}</p>
            </div>

            <div className="bg-white rounded-lg shadow p-4 mt-4">
              <div className="space-y-3">
                <div><label className="text-xs text-gray-500">Full Name</label><p className="text-sm font-medium">{profile.name}</p></div>
                <div><label className="text-xs text-gray-500">Email</label><p className="text-sm font-medium break-all">{profile.email}</p></div>
                <div><label className="text-xs text-gray-500">Phone</label><p className="text-sm font-medium">{profile.phone}</p></div>
                <div><label className="text-xs text-gray-500">Company</label><p className="text-sm font-medium">{profile.company}</p></div>
                <div>
                  <label className="text-xs text-gray-500">Role</label>
                  <span className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">{profile.role}</span>
                </div>
              </div>
            </div>

            <div className="space-y-2 mt-4">
              <button type="button" onClick={() => router.push('/settings')} className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold">Profile settings</button>
              <button type="button" onClick={() => router.push('/auth/reset')} className="w-full bg-gray-200 text-gray-700 py-3 rounded-lg font-semibold">Change password</button>
              <button type="button" onClick={() => void logout()} disabled={loggingOut} className="w-full bg-red-50 text-red-600 py-3 rounded-lg font-semibold disabled:opacity-60">{loggingOut ? 'Signing out…' : 'Sign out'}</button>
            </div>
          </>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around py-2 px-4">
        <button onClick={() => router.push('/')} className="flex flex-col items-center text-gray-400"><span className="text-xl">🏠</span><span className="text-xs">Home</span></button>
        <button onClick={() => router.push('/profile')} className="flex flex-col items-center text-blue-600"><span className="text-xl">👤</span><span className="text-xs">Profile</span></button>
        <button onClick={() => router.push('/export')} className="flex flex-col items-center text-gray-400"><span className="text-xl">📤</span><span className="text-xs">Export</span></button>
        <button onClick={() => router.push('/notifications')} className="flex flex-col items-center text-gray-400"><span className="text-xl">🔔</span><span className="text-xs">Alerts</span></button>
        <button onClick={() => router.push('/settings')} className="flex flex-col items-center text-gray-400"><span className="text-xl">⚙️</span><span className="text-xs">Settings</span></button>
      </nav>
    </div>
  )
}
