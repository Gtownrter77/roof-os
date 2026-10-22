'use client'

import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function AcceptInvitationContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const invitationId = searchParams.get('invitationId')?.trim() ?? ''
  const [message, setMessage] = useState('Accepting invitation…')
  const [error, setError] = useState('')
  const [accepted, setAccepted] = useState(false)
  const started = useRef(false)
  const returnPath = useMemo(() => `/team/invitations/accept?invitationId=${encodeURIComponent(invitationId)}`, [invitationId])

  useEffect(() => {
    if (started.current) return
    started.current = true
    if (!/^[0-9a-f-]{36}$/i.test(invitationId)) {
      setError('This invitation link is missing a valid invitation ID.')
      return
    }
    let cancelled = false
    fetch('/api/team/invitations/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invitationId }),
    })
      .then(async response => {
        const body = await response.json().catch(() => ({}))
        if (response.status === 401) {
          router.replace(`/auth/login?next=${encodeURIComponent(returnPath)}`)
          return
        }
        if (!response.ok) {
          const raw = typeof body.error === 'string' ? body.error : 'Invitation acceptance failed.'
          if (/expired/i.test(raw)) throw new Error('This invitation has expired. Ask the workspace administrator to send a new one.')
          if (/no longer pending|accepted|revoked/i.test(raw)) throw new Error('This invitation was already used or is no longer active.')
          throw new Error(raw)
        }
        if (!cancelled) { setAccepted(true); setMessage('Invitation accepted. Your workspace access is active.') }
      })
      .catch(err => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Invitation acceptance failed.')
      })
    return () => { cancelled = true }
  }, [invitationId, returnPath, router])

  return (
    <main className="mx-auto flex min-h-screen max-w-xl items-center px-6 py-12">
      <section className="w-full glass rounded-xl p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Workspace invitation</h1>
        {error ? <p className="mt-4 text-red-300" role="alert">{error}</p> : <p className="mt-4 text-slate-200" role="status">{message}</p>}
        {accepted && <p className="mt-2 text-sm text-emerald-300">You can now open the workspace and continue your work.</p>}
        <div className="mt-6 flex gap-3"><a className="rounded-lg bg-black px-4 py-2 text-white" href="/">Continue to ROOF/OS</a>{error && <a className="rounded-lg border border-white/20 px-4 py-2 text-slate-200" href={`/auth/login?next=${encodeURIComponent(returnPath)}`}>Sign in again</a>}</div>
      </section>
    </main>
  )
}

export default function AcceptInvitationPage() {
  return <Suspense fallback={<main className="mx-auto flex min-h-screen max-w-xl items-center px-6 py-12"><section className="w-full glass rounded-xl p-8 shadow-sm"><h1 className="text-2xl font-semibold">Workspace invitation</h1><p className="mt-4 text-slate-200">Loading invitation…</p></section></main>}><AcceptInvitationContent /></Suspense>
}
