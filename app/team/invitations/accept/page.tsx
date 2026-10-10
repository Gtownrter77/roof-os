'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'

function AcceptInvitationContent() {
  const searchParams = useSearchParams()
  const invitationId = searchParams.get('invitationId')
  const [message, setMessage] = useState('Accepting invitation…')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!invitationId) {
      setError('This invitation link is missing its invitation ID.')
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
        if (!response.ok) throw new Error(body.error || 'Invitation acceptance failed.')
        if (!cancelled) setMessage('Invitation accepted. Your workspace access is active.')
      })
      .catch(err => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Invitation acceptance failed.')
      })
    return () => { cancelled = true }
  }, [invitationId])

  return (
    <main className="mx-auto flex min-h-screen max-w-xl items-center px-6 py-12">
      <section className="w-full glass rounded-xl p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Workspace invitation</h1>
        {error ? (
          <p className="mt-4 text-red-700">{error}</p>
        ) : (
          <p className="mt-4 text-slate-200">{message}</p>
        )}
        <a className="mt-6 inline-block rounded-lg bg-black px-4 py-2 text-white" href="/">
          Continue to ROOF/OS
        </a>
      </section>
    </main>
  )
}

export default function AcceptInvitationPage() {
  return (
    <Suspense fallback={<main className="mx-auto flex min-h-screen max-w-xl items-center px-6 py-12"><section className="w-full glass rounded-xl p-8 shadow-sm"><h1 className="text-2xl font-semibold">Workspace invitation</h1><p className="mt-4 text-slate-200">Loading invitation…</p></section></main>}>
      <AcceptInvitationContent />
    </Suspense>
  )
}
