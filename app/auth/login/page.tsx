'use client'

import { Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { safeNextPath } from '../../../lib/safe-next'

function EnterForward() {
  const router = useRouter()
  const search = useSearchParams()
  const next = safeNextPath(
    search.get('next'),
    typeof window === 'undefined' ? 'https://invalid.local' : window.location.origin,
  )

  useEffect(() => {
    router.replace(`/auth/enter?next=${encodeURIComponent(next)}`)
    router.refresh()
  }, [next, router])

  return (
    <main className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-white">
      <section className="w-full max-w-sm rounded-2xl border border-white/10 bg-slate-900 p-6 text-center shadow-lg">
        <h1 className="text-xl font-bold">Entering ROOF/OS</h1>
        <p className="mt-2 text-sm text-slate-300">
          Login page skipped. Opening your workspace as owner.
        </p>
      </section>
    </main>
  )
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
          Entering…
        </main>
      }
    >
      <EnterForward />
    </Suspense>
  )
}
